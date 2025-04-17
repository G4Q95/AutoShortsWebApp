from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
from pydantic import BaseModel, ConfigDict, Field
import json

from app.utils.bson_encoders import json_encoder

# Define a generic type variable for response data
T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    """
    Standard API response model that wraps data with success/error information.
    
    Generic type T is used for the data field.
    
    Attributes:
        success (bool): Indicates if the request was successful
        data (Optional[T]): Response data (only present if success is True)
        error (Optional[str]): Error message (only present if success is False)
        message (Optional[str]): Optional message (informational)
        meta (Optional[Dict[str, Any]]): Optional metadata
    """
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    message: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={"bson.objectid.ObjectId": str}
    )
    
    def model_dump_json(self, **kwargs) -> str:
        """
        Override default model_dump_json to use custom encoder.
        
        Args:
            **kwargs: Additional arguments passed to json.dumps
            
        Returns:
            JSON string representation of the model
        """
        # Get default kwarg values from model_dump
        exclude_none = kwargs.pop("exclude_none", True)
        indent = kwargs.pop("indent", None)
        
        # Generate dict representation
        data = self.model_dump(exclude_none=exclude_none)
        
        # Use custom encoder and return as JSON
        return json.dumps(
            data,
            default=json_encoder,
            indent=indent,
            **kwargs
        ) 