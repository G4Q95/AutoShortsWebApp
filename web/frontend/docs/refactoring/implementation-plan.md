# Voice API Integration Implementation Plan

## Overview

This document outlines a detailed step-by-step plan for implementing and integrating the voice-related API functions from the new modular architecture into the existing codebase. We'll use a feature flag approach to ensure stability throughout the process.

## Prerequisites

✅ API Function Inventory - Completed
✅ Feature Flag System - Implemented
✅ Voice API Module - Created
✅ Test API Page - Created
✅ Initial Unit Tests - Created

## Implementation Steps

### Step 1: Integrate Feature Flags with `getAvailableVoices`

**Status**: ✅ Completed

```typescript
// Original implementation in api-client.ts
export async function getAvailableVoices(): Promise<ApiResponse<VoiceListResponse>> {
  logImplementationChoice('getAvailableVoices', API_FLAGS.useNewGetVoices || API_FLAGS.useNewVoiceAPI);
  
  if (API_FLAGS.useNewGetVoices || API_FLAGS.useNewVoiceAPI) {
    return voiceAPI.getAvailableVoices();
  }
  
  // Original implementation remains
  return fetchAPI<VoiceListResponse>(
    `/voice/voices`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    15000
  );
}
```

**Testing**:
- Verify with feature flag OFF (original implementation)
- Verify with feature flag ON (new implementation)
- Run all audio generation tests with both implementations

### Step 2: Integrate Feature Flags with `getVoiceById`

**Status**: 🔄 In Progress

```typescript
// Original implementation in api-client.ts
export async function getVoiceById(voiceId: string): Promise<ApiResponse<Voice>> {
  logImplementationChoice('getVoiceById', API_FLAGS.useNewGetVoiceById || API_FLAGS.useNewVoiceAPI);
  
  if (API_FLAGS.useNewGetVoiceById || API_FLAGS.useNewVoiceAPI) {
    return voiceAPI.getVoiceById(voiceId);
  }
  
  // Original implementation remains
  return fetchAPI<Voice>(
    `/voice/voices/${voiceId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
```

**Testing**:
- Create page to display a specific voice
- Verify with feature flag OFF (original implementation)
- Verify with feature flag ON (new implementation)

### Step 3: Integrate Feature Flags with `generateVoice`

**Status**: ⏳ Planned

This is the most critical function and requires careful implementation:

```typescript
// Original implementation in api-client.ts
export async function generateVoice(
  requestData: GenerateVoiceRequest
): Promise<ApiResponse<GenerateVoiceResponse>> {
  logImplementationChoice('generateVoice', API_FLAGS.useNewGenerateVoice || API_FLAGS.useNewVoiceAPI);
  
  if (API_FLAGS.useNewGenerateVoice || API_FLAGS.useNewVoiceAPI) {
    return voiceAPI.generateVoice(requestData);
  }
  
  // Original implementation remains below
  // ...
}
```

**Testing**:
- Run audio generation tests multiple times
- Verify mock audio implementation works
- Manually test voice generation on test page 
- Monitor network requests
- Check for console errors

### Step 4: Integrate Feature Flags with `generateVoiceAudio`

**Status**: ⏳ Planned

```typescript
// Original implementation in api-client.ts
export async function generateVoiceAudio(
  request: GenerateVoiceRequest
): Promise<{
  audio: HTMLAudioElement | null;
  error: ApiError | null;
  characterCount: number;
  processingTime: number;
}> {
  logImplementationChoice('generateVoiceAudio', API_FLAGS.useNewGenerateVoice || API_FLAGS.useNewVoiceAPI);
  
  if (API_FLAGS.useNewGenerateVoice || API_FLAGS.useNewVoiceAPI) {
    return voiceAPI.generateVoiceAudio(request);
  }
  
  // Original implementation remains below
  // ...
}
```

**Testing**:
- Test with feature flag OFF
- Test with feature flag ON
- Verify audio element creation
- Test in both mock and real API mode

### Step 5: Integrate Feature Flags with `persistVoiceAudio`

**Status**: ⏳ Planned

```typescript
// Original implementation in api-client.ts
export async function persistVoiceAudio(
  requestData: SaveAudioRequest
): Promise<ApiResponse<SaveAudioResponse>> {
  logImplementationChoice('persistVoiceAudio', API_FLAGS.useNewPersistVoiceAudio || API_FLAGS.useNewVoiceAPI);
  
  if (API_FLAGS.useNewPersistVoiceAudio || API_FLAGS.useNewVoiceAPI) {
    return voiceAPI.persistVoiceAudio(requestData);
  }
  
  // Original implementation remains below
  // ...
}
```

**Testing**:
- Create test project with scene
- Generate voice audio and verify persistence
- Check R2 storage functionality
- Verify audio retrieval after persistence

### Step 6: Integrate Feature Flags with `getStoredAudio`

**Status**: ⏳ Planned

```typescript
// Original implementation in api-client.ts
export async function getStoredAudio(
  projectId: string,
  sceneId: string
): Promise<ApiResponse<GetAudioResponse>> {
  logImplementationChoice('getStoredAudio', API_FLAGS.useNewGetStoredAudio || API_FLAGS.useNewVoiceAPI);
  
  if (API_FLAGS.useNewGetStoredAudio || API_FLAGS.useNewVoiceAPI) {
    return voiceAPI.getStoredAudio(projectId, sceneId);
  }
  
  // Original implementation remains below
  // ...
}
```

**Testing**:
- Create test project with stored audio
- Verify retrieval with both implementations
- Check audio playback after retrieval

### Step 7: End-to-End Testing with Test API Page

**Status**: ⏳ Planned

Use the test-api-flags page to toggle all implementations on and off:

1. Create a test project
2. Add a scene with Reddit content 
3. Toggle between implementations
4. Test voice generation with each setup
5. Compare results and performance

### Step 8: Gradual Rollout

**Status**: ⏳ Planned

Once all functions pass individual testing:

1. Enable new implementations for 1-2 functions at a time
2. Run full test suite with each change
3. Manually verify functionality
4. Monitor for console errors or unexpected behavior
5. Document any discrepancies

### Step 9: Complete Transition

**Status**: ⏳ Planned

After all functions have been individually tested and verified:

1. Enable all new implementations by default
2. Run all tests multiple times
3. Review performance metrics
4. Check for error patterns
5. Document successful transition

## Feature Flag Logic

Use the flags to control API implementation choice:

```typescript
// Direct function flags
API_FLAGS.useNewGetVoices
API_FLAGS.useNewGetVoiceById
API_FLAGS.useNewGenerateVoice
API_FLAGS.useNewPersistVoiceAudio
API_FLAGS.useNewGetStoredAudio

// Master flag for all voice-related functions
API_FLAGS.useNewVoiceAPI
```

## Testing Protocol

For each function modification:

1. Run function-specific tests with flag OFF
2. Run function-specific tests with flag ON
3. Run full test suite with flag OFF
4. Run full test suite with flag ON
5. Compare results and performance
6. Document any discrepancies
7. Fix issues before proceeding

## Validation Approach

For each function:

1. **Code Inspection**
   - Compare implementations side by side
   - Verify identical request/response formats
   - Check for edge case handling

2. **Functionality Testing**
   - Test with identical inputs
   - Compare outputs for exact matches
   - Verify error responses are consistent

3. **Performance Testing**
   - Compare execution time between implementations
   - Monitor memory usage
   - Check for any rendering impacts

## Fallback Strategy

In case of issues:

1. Immediately disable the new implementation using feature flag
2. Document the specific error or issue encountered
3. Fix in the new module without affecting original
4. Retest before re-enabling

## Endpoint Consistency

Ensure all endpoints are consistent between implementations:

- `/voice/voices` - Get all voices
- `/voice/voices/:id` - Get voice by ID
- `/voice/generate` - Generate voice
- `/voice/persist` - Save voice audio
- `/voice/audio/:projectId/:sceneId` - Get stored audio

## Implementation Verification Checklist

For each function:

- [ ] Parameter types match exactly
- [ ] Return types match exactly
- [ ] Error handling is consistent
- [ ] Mock implementation behaves identically
- [ ] Performance is similar or better
- [ ] No console errors occur
- [ ] All tests pass with feature flag ON
- [ ] All tests pass with feature flag OFF

## Success Criteria

The implementation is considered successful when:

1. All voice-related API functions can be toggled between implementations
2. All Playwright tests pass with both implementations
3. No console errors occur with either implementation
4. User experience is identical regardless of implementation
5. API response formats match exactly

## Final Steps

After successful individual implementations:

1. Enable all new modules by default
2. Run comprehensive test suite multiple times
3. Conduct manual testing across key scenarios
4. Document any minor differences
5. Plan for cleanup of duplicate code 