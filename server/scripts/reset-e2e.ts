import { execFileSync } from 'child_process';

const VOLUME_NAME = 'hermes-board-mcp_hermes-e2e-data';

function docker(args: string[]) {
  const cmd = ['docker', ...args].join(' ');
  console.log(`> ${cmd}`);
  execFileSync('docker', args, { stdio: 'inherit' });
}

function dockerBestEffort(args: string[]) {
  try {
    docker(args);
  } catch {
    // Ignore cleanup errors, such as removing a container that does not exist.
  }
}

dockerBestEffort(['rm', '-f', 'hermes-e2e-reset']);
dockerBestEffort(['compose', '-f', 'docker-compose.e2e.yml', 'down']);
dockerBestEffort(['volume', 'create', VOLUME_NAME]);

docker([
  'run',
  '--rm',
  '--name',
  'hermes-e2e-reset',
  '-v',
  `${VOLUME_NAME}:/data`,
  'node:20-slim',
  'sh',
  '-c',
  'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true',
]);

console.log(`[reset-e2e] Volume ${VOLUME_NAME} reset successfully`);
