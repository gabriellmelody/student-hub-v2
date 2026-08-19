import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settingsSource = readFileSync(
  new URL("../pages/SettingsPage.jsx", import.meta.url),
  "utf8"
);

const classroomSyncProps = [
  "user",
  "classroomSyncSettings",
  "classroomSyncSettingsLoading",
  "classroomSyncSettingsError",
  "setClassroomSyncSettings",
  "classroomSyncStatus",
  "onSyncClassroomNow",
];

function getFunctionPropsBlock(functionName) {
  const marker = `function ${functionName}({`;
  const start = settingsSource.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const bodyStart = start + marker.length;
  const end = settingsSource.indexOf("}) {", bodyStart);
  assert.notEqual(end, -1, `${functionName} props must be destructured`);
  return settingsSource.slice(bodyStart, end);
}

test("Settings forwards Classroom sync props into Integrations", () => {
  const integrationRenderStart = settingsSource.indexOf("<IntegrationsSettings");
  assert.notEqual(integrationRenderStart, -1);
  const integrationRenderEnd = settingsSource.indexOf("/>", integrationRenderStart);
  const integrationRender = settingsSource.slice(
    integrationRenderStart,
    integrationRenderEnd
  );

  classroomSyncProps.forEach((propName) => {
    assert.match(
      integrationRender,
      new RegExp(`${propName}=\\{${propName}\\}`),
      `${propName} should be passed to IntegrationsSettings`
    );
  });
});

test("Integrations destructures Classroom sync props before using them", () => {
  const propsBlock = getFunctionPropsBlock("IntegrationsSettings");

  classroomSyncProps.forEach((propName) => {
    assert.match(
      propsBlock,
      new RegExp(`\\b${propName}\\b`),
      `${propName} should be destructured by IntegrationsSettings`
    );
  });
});
