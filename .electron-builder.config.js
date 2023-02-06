/**
 * @type {() => import("electron-builder").Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = async function () {
  const { getVersion } = await import("./version/getVersion.mjs");

  return {
    appId: "rzuppur.rekordfix",
    productName: "Rekordfix",
    directories: {
      output: "dist",
      buildResources: "buildResources",
    },
    files: ["packages/**/dist/**"],
    extraMetadata: {
      version: getVersion(),
    },
    linux: {
      target: "deb",
    },
  };
};
