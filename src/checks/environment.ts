import os from 'node:os';
import type { Probe } from '../types.js';

export const checkEnvironment: Probe = async () => ({
  id: 'environment',
  category: 'environment',
  name: '运行环境',
  status: 'pass',
  summary: `${os.platform()} ${os.release()} / ${os.arch()} / Node ${process.version}`,
  details: {
    platform: os.platform(),
    release: os.release(),
    architecture: os.arch(),
    node: process.version,
  },
});
