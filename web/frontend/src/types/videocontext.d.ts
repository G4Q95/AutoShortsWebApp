declare module 'videocontext' {
  interface VideoContextInstance {
    video: (url: string) => SourceNode;
    image: (url: string) => SourceNode;
    audio: (url: string) => AudioNode;
    canvas: HTMLCanvasElement;
    currentTime: number;
    destination: DestinationNode;
    registerTimeUpdateCallback: (callback: (time: number) => void) => void;
    registerCallback: (event: string, callback: () => void) => void;
    play: () => void;
    pause: () => void;
    reset: () => void;
    dispose: () => void;
  }

  interface VideoElement extends HTMLMediaElement {
    videoWidth: number;
    videoHeight: number;
  }

  interface SourceNode {
    start: (time: number) => void;
    stop: (time: number) => void;
    connect: (node: any) => void;
    disconnect: () => void;
    registerCallback: (event: string, callback: () => void) => void;
    element: VideoElement | HTMLImageElement;
  }

  interface AudioNode {
    start: (time: number) => void;
    stop: (time: number) => void;
    connect: (node: any) => void;
    disconnect: () => void;
    duration: number;
  }

  interface DestinationNode {
    connect: (node: any) => void;
  }

  const VideoContext: {
    new (canvas: HTMLCanvasElement): VideoContextInstance;
    DEFINITIONS: Record<string, any>;
  };

  export default VideoContext;
} 