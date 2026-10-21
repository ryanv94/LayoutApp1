import { test as base, expect } from '@playwright/test';
import path from 'node:path';

export const test = base;
export { expect };
export const fixture = (name: string) => path.resolve('tests/fixtures', name);
