import React, { useEffect } from 'react';

const SceneComponent = () => {
  const canGenerateVoice = (() => {
    const hasSceneText = scene.text && scene.text.trim() !== '';
    const hasSelectedVoice = selectedVoice && selectedVoice !== '';
    const notGeneratingVoice = !isGeneratingVoice;
    const notPlayingAudio = !isPlaying;
    
    // Add detailed logging for debugging tests
    if (process.env.NEXT_PUBLIC_TESTING_MODE === 'true' || window.USE_MOCK_AUDIO) {
      console.log('VOICE BUTTON DEBUG:', {
        hasSceneText,
        hasSelectedVoice,
        notGeneratingVoice,
        notPlayingAudio,
        mockAudioEnabled: Boolean(window.USE_MOCK_AUDIO),
        testingMode: process.env.NEXT_PUBLIC_TESTING_MODE,
        sceneTextLength: scene.text?.length || 0,
        sceneId: scene.id,
        sceneMediaType: scene.media_type,
        audioGenerated: Boolean(generatedAudio),
        buttonShouldBeEnabled: hasSceneText && hasSelectedVoice && notGeneratingVoice && notPlayingAudio
      });
    }
    
    return hasSceneText && hasSelectedVoice && notGeneratingVoice && notPlayingAudio;
  })();

  const handleGenerateVoice = async () => {
    try {
      // Log when generation is attempted
      console.log('Voice generation initiated:', {
        sceneId: scene.id,
        mockAudioEnabled: Boolean(window.USE_MOCK_AUDIO),
        testingMode: process.env.NEXT_PUBLIC_TESTING_MODE,
        voiceId: selectedVoice,
        textLength: scene.text?.length || 0
      });
      
      // ... existing code ...
      
      setIsGeneratingVoice(true);
      
      // ... existing code for voice generation ...
    } catch (error) {
      console.error('Error generating voice:', error);
      // ... existing error handling ...
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  useEffect(() => {
    // Log component initialization for debugging
    if (process.env.NEXT_PUBLIC_TESTING_MODE === 'true' || window.USE_MOCK_AUDIO) {
      console.log('Scene component initialized for voice:', {
        sceneId: scene.id,
        mockAudioEnabled: Boolean(window.USE_MOCK_AUDIO),
        testingMode: process.env.NEXT_PUBLIC_TESTING_MODE,
        hasText: Boolean(scene.text),
        hasSelectedVoice: Boolean(selectedVoice),
        canGenerateVoice
      });
    }
  }, [scene.id, canGenerateVoice, selectedVoice]);

  return (
    // ... existing code ...
  );
};

export default SceneComponent; 