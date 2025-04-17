from typing import Annotated, Any, Callable, ClassVar, Dict, List, Optional, Type, get_type_hints
import json
from datetime import datetime

from bson import ObjectId
from pydantic import GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema

def json_encoder(obj: Any) -> Any:
    """
    Custom JSON encoder for MongoDB ObjectId and datetime.
    
    Args:
        obj: Object to encode
        
    Returns:
        JSON serializable object
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

class PydanticObjectId(str):
    """
    Custom type for handling MongoDB ObjectId in Pydantic models.
    Compatible with Pydantic v2.
    
    Usage:
        id: PydanticObjectId = Field(default_factory=PydanticObjectId, alias="_id")
    """
    
    @classmethod
    def __get_validators__(cls) -> List[Callable]:
        """
        Return validators for backwards compatibility with Pydantic v1.
        
        Returns:
            List of validators
        """
        return [cls.validate]
    
    @classmethod
    def validate(cls, v: Any) -> str:
        """
        Validate and convert ObjectId to string.
        
        Args:
            v: Value to validate
            
        Returns:
            String representation of ObjectId
            
        Raises:
            ValueError: If value is not a valid ObjectId
        """
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return v
            raise ValueError("Invalid ObjectId")
        raise ValueError("Invalid ObjectId")
    
    @classmethod
    def __get_pydantic_core_schema__(
        cls, 
        _source_type: Any, 
        _handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """
        Used by Pydantic v2 for schema validation.
        
        Args:
            _source_type: Source type
            _handler: Core schema handler
            
        Returns:
            Pydantic core schema
        """
        return core_schema.string_schema(
            pattern="^[0-9a-fA-F]{24}$",
            description="MongoDB ObjectId (24-character hex string)",
        )
    
    @classmethod
    def __get_pydantic_json_schema__(
        cls,
        _schema: Any, 
        _handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        """
        Used by Pydantic v2 for OpenAPI schema generation.
        
        Args:
            _schema: JSON schema
            _handler: JSON schema handler
            
        Returns:
            JSON schema
        """
        return {
            "type": "string", 
            "format": "objectid",
            "description": "MongoDB ObjectId (24-character hex string)",
            "pattern": "^[0-9a-fA-F]{24}$"
        } 