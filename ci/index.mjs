import { connect } from "@dagger.io/dagger"

connect(
  async (client) => {
    // use a node:16-slim container
    // mount the source code directory on the host
    // at /src in the container
    const source = client
      .container()
      .from("node:16-slim")
      .withDirectory(
        "/src",
        client.host().directory(".", {
          exclude: ["node_modules/", "ci/", "build/", ".git/"],
        }),
      )

    // set the working directory in the container
    // install application dependencies
    const runner = source
      .withWorkdir("/src")
      .withMountedCache(
        "/src/node_modules",
        client.cacheVolume("node_module_cache"),
      )
      .withExec(["echo", "Before npm install"]) // Add log statement
      .withExec(["npm", "cache", "clean", "--force"]) // Clean npm cache
      .withExec(["npm", "install"])
      .withExec(["echo", "npm install completed"]) // Add log statement

    // run application tests
    const test = runner
    .withExec(["npm", "test", "--", "--watchAll=false"])
    .withExec(["echo", "npm test completed"]) // Add log statement

    // build application
    // write the build output to the host
    await test
      .withExec(["npm", "run", "build"])
      .withExec(["echo", "npm run build completed"]) // Add log statement
      .directory("./build")
      .export("./build")

    // use an nginx:alpine container
    // copy the build/ directory into the container filesystem
    // at the nginx server root
    // publish the resulting container to a registry
    const imageRef = await client
      .container()
      .from("nginx:1.23-alpine")
      .withDirectory(
        "/usr/share/nginx/html",
        client.host().directory("./build"),
      )
      .publish("ttl.sh/hello-dagger-" + Math.floor(Math.random() * 10000000))
    console.log(`Published image to: ${imageRef}`)
  },
  { LogOutput: process.stderr },
)