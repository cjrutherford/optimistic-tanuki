const { exec } = require('child_process');

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  // await new Promise<void>((resolve, reject) => {
  //   exec(
  //     'docker compose -f ./apps/authentication-e2e/src/support/docker-compose.authentication-e2e.yaml stop   ',
  //     (error, stdout, stderr) => {
  //       if (error) {
  //         console.error(`Error running docker compose down: ${stderr}`);
  //         reject(error);
  //       } else {
  //         console.log(stdout);
  //         resolve();
  //       }
  //     }
  //   );
  // });
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
