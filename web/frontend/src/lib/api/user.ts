/**
 * @fileoverview User management API client for interacting with the backend
 * 
 * This module provides functions for user management:
 * - Getting current user information
 * - User authentication
 * - User preferences
 */

import { fetchAPI } from './core';
import { ApiResponse } from '../api-types';

/**
 * User response from the API
 */
export interface UserResponse {
  /** User ID */
  id: string;
  /** User email */
  email: string;
  /** User display name */
  name: string;
  /** User profile picture URL */
  profile_picture?: string;
  /** User preferences */
  preferences?: Record<string, any>;
  /** User subscription status */
  subscription?: {
    /** Subscription plan */
    plan: 'free' | 'basic' | 'premium';
    /** Subscription status */
    status: 'active' | 'inactive' | 'trial';
    /** Subscription expiration date */
    expires_at?: string;
  };
  /** User API usage */
  api_usage?: {
    /** Voice generation credits used */
    voice_credits_used: number;
    /** Voice generation credits remaining */
    voice_credits_remaining: number;
    /** Video generation credits used */
    video_credits_used: number;
    /** Video generation credits remaining */
    video_credits_remaining: number;
  };
}

/**
 * Get current user information
 * 
 * @returns {Promise<ApiResponse<UserResponse>>} Promise with user information
 */
export async function getCurrentUser(): Promise<ApiResponse<UserResponse>> {
  return fetchAPI<UserResponse>('/user', { method: 'GET' });
}

/**
 * Update user preferences
 * 
 * @param {Record<string, any>} preferences - User preferences to update
 * @returns {Promise<ApiResponse<UserResponse>>} Promise with updated user information
 */
export async function updateUserPreferences(
  preferences: Record<string, any>
): Promise<ApiResponse<UserResponse>> {
  return fetchAPI<UserResponse>('/user/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}

/**
 * Get user API usage
 * 
 * @returns {Promise<ApiResponse<UserResponse['api_usage']>>} Promise with API usage information
 */
export async function getUserApiUsage(): Promise<ApiResponse<UserResponse['api_usage']>> {
  return fetchAPI<UserResponse['api_usage']>('/user/api-usage', { method: 'GET' });
}

/**
 * Update user profile
 * 
 * @param {Partial<Pick<UserResponse, 'name' | 'profile_picture'>>} profile - Profile data to update
 * @returns {Promise<ApiResponse<UserResponse>>} Promise with updated user information
 */
export async function updateUserProfile(
  profile: Partial<Pick<UserResponse, 'name' | 'profile_picture'>>
): Promise<ApiResponse<UserResponse>> {
  return fetchAPI<UserResponse>('/user/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
} 