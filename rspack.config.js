// Picked up by `nest build` (rspack builder) for every app.
// The Prisma client uses dynamic import(); by default rspack emits those as
// separate chunk files loaded from a build-time path that doesn't exist once
// the app is copied into its Docker image. Bundling them eagerly keeps each
// app a single dist/apps/<app>/main.js.
export default function rspackConfig(options) {
  return {
    ...options,
    module: {
      ...options.module,
      parser: {
        ...options.module?.parser,
        javascript: {
          ...options.module?.parser?.javascript,
          dynamicImportMode: 'eager',
        },
      },
    },
  };
}
