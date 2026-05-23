import { version } from '../package.json';

export { createEnhanceInstance, defaultRetryCondition } from './core';
export { version };
export { getFormData, hash } from './utils';
export type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig, RetryConfig, ContentType, PreventDuplicateOption, CancelRequestOption, RetryOption, TokenInfo, TokenAuthConfig } from './types';
export type { AxiosRequestConfig } from 'axios';