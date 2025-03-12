"""
Custom JSON encoder for MongoDB ObjectId handling.
"""

import json
from datetime import datetime
from bson import ObjectId


class MongoJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles MongoDB ObjectId and datetime objects.
    """
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj) 