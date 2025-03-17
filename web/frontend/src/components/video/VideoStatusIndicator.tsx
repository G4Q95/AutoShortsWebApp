  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs ${getStyleByStatus(status)}`}
      data-testid={`video-status-${status}`}
    >
      <div className="flex items-center space-x-2" data-testid="video-status-content">
        {getIconByStatus(status)}
        <span data-testid="video-status-message">{getMessageByStatus(status)}</span>
      </div>
      {renderProgressOrLink()}
    </button>
  );
};

const renderProgressOrLink = () => {
  if (status === 'generating' || status === 'uploading') {
    return (
      <div className="flex items-center" data-testid="video-status-progress">
        <span className="mr-2">{progress}%</span>
        <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full" 
            style={{ width: `${progress}%` }}
            data-testid="video-status-progress-bar"
          ></div>
        </div>
      </div>
    );
  }
  
  if (status === 'completed' && videoUrl) {
    return (
      <div className="flex items-center space-x-1" data-testid="video-status-actions">
        <a 
          href={videoUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-500 hover:text-blue-600"
          data-testid="video-status-view-link"
        >
          View
        </a>
        <span>|</span>
        <a 
          href={videoUrl} 
          download 
          onClick={(e) => e.stopPropagation()}
          className="text-blue-500 hover:text-blue-600"
          data-testid="video-status-download-link"
        >
          Download
        </a>
      </div>
    );
  }
  
  return null;
}; 