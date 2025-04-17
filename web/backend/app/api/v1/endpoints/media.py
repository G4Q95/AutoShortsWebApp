import logging

from app.services.media_processing import process_media_upload
from app.services.r2_service import create_presigned_url, r2_upload_file_obj

logger = logging.getLogger(__name__)

@router.post(
    "/store",
    response_model=MediaStorageResponse,
    summary="Store media content from URL",
    description="Downloads media from a URL, stores it in R2, and returns storage details.",
)
async def store_media_content(
    request: MediaStorageRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    r2: Annotated[R2Service, Depends(get_r2_service)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
):
    logger.info(f"Received request to store media for project {request.project_id}, scene {request.scene_id}")
    logger.debug(f"Media store request details: {request}")

    try:
        result = await process_media_upload(
            url=request.url,
            project_id=request.project_id,
            scene_id=request.scene_id,
            media_type=request.media_type,
            create_thumbnail=request.create_thumbnail,
            r2_service=r2,
            settings=settings,
            db=db, # Pass db instance
        )
        
        # --- LOG POINT 1: After R2 Upload ---
        logger.info(f"process_media_upload completed for scene {request.scene_id}")

        # Log the entire settings object for debugging
        # logger.info(f"[SETTINGS CHECK] Settings object contents: {settings}") # Removed Debug

        if not result or not result.get("storage_key"):
            logger.error("process_media_upload did not return a valid result or storage_key.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Media processing failed to return storage key.",
            )

        storage_key = result["storage_key"]
        media_type = result.get("media_type")
        content_type = result.get("content_type")
        file_size = result.get("file_size")
        thumbnail_storage_key = result.get("thumbnail_storage_key")

        logger.info(f"Media successfully stored: {storage_key}")

        # --- LOG POINT 2: URL Construction ---
        final_url = None
        thumbnail_url = None
        
        try:
            # --- LOG POINT 2a: Check R2_PUBLIC_URL Setting ---
            # logger.info(f"Checking R2_PUBLIC_URL setting value: '{settings.R2_PUBLIC_URL}'") # Removed Debug
            # logger.info(f"Type of R2_PUBLIC_URL: {type(settings.R2_PUBLIC_URL)}") # Removed Debug

            if storage_key and settings.R2_PUBLIC_URL:
                # Ensure no leading slash on storage_key for URL concatenation
                url_key = storage_key.lstrip('/')
                final_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{url_key}"
                # logger.info(f"Constructed final R2 URL: {final_url}") # Removed Debug
                # logger.debug(f"URL Components: Base='{settings.R2_PUBLIC_URL}', Key='{url_key}'") # Removed Debug
            else:
                logger.warning("Could not construct final URL. Missing storage_key or R2_PUBLIC_URL.")
                # logger.debug(f"Storage Key: {storage_key}, R2 Public URL Set: {bool(settings.R2_PUBLIC_URL)}") # Removed Debug

            if thumbnail_storage_key and settings.R2_PUBLIC_URL:
                 # Ensure no leading slash on thumbnail_key for URL concatenation
                thumb_key = thumbnail_storage_key.lstrip('/')
                thumbnail_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{thumb_key}"
                # logger.info(f"Constructed thumbnail R2 URL: {thumbnail_url}") # Removed Debug
            else:
                 # Log only if thumbnail expected but couldn't be constructed
                 if request.create_thumbnail and not thumbnail_storage_key:
                      logger.warning("Thumbnail requested but no thumbnail_storage_key was generated.")
                 elif request.create_thumbnail and not settings.R2_PUBLIC_URL:
                      logger.warning("Thumbnail key exists but R2_PUBLIC_URL is not set.")

        except Exception as e:
            logger.error(f"EXCEPTION during URL construction: {e}", exc_info=True)
            # Ensure final_url and thumbnail_url remain None if an error occurs

        # --- LOG POINT 3: Before Returning Response ---
        response_data = MediaStorageResponse(
            success=True,
            url=final_url, # Use the constructed URL
            storage_key=storage_key,
            media_type=media_type,
            content_type=content_type,
            file_size=file_size,
            original_url=request.url,
            thumbnail_url=thumbnail_url,
            metadata=result.get("metadata"),
        )
        logger.info(f"Preparing final response for scene {request.scene_id}")
        # logger.debug(f"Final response data to be sent: {response_data.dict()}") # Removed Debug

        return response_data

    except HTTPException as http_exc:
        logger.error(f"HTTPException storing media for scene {request.scene_id}: {http_exc.detail}", exc_info=True)
        raise http_exc # Re-raise already handled HTTP exceptions
    except Exception as e:
        logger.exception(f"Unexpected error storing media for project {request.project_id}, scene {request.scene_id}") # Use logger.exception to include traceback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during media storage: {str(e)}",
        ) 