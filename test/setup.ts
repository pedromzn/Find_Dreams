/**
 * Runs before every test file: the tests get a fresh, empty workspace in the system temp folder, never the
 * developer's `./workspace` (which holds a real CV and real applications).
 */

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { config } from '../server/config.js'

config.workspaceFolder = mkdtempSync(path.join(tmpdir(), 'mzn-vagas-test-'))
