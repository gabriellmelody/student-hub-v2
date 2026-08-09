import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOCAL_PROFILE,
  LOCAL_PROFILE_STORAGE_KEY,
  clearLocalProfile,
  getLocalProfileInitials,
  isValidLocalProfileName,
  loadLocalProfile,
  saveLocalProfile,
} from "./localProfileUtils.js";

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("default local profile is Student with the initials avatar", () => {
  const profile = loadLocalProfile(createMemoryStorage());

  assert.deepEqual(profile, DEFAULT_LOCAL_PROFILE);
  assert.equal(getLocalProfileInitials(profile.displayName), "S");
});

test("initials use first and last names and preserve one-word names", () => {
  assert.equal(getLocalProfileInitials("Gabriel Melody"), "GM");
  assert.equal(getLocalProfileInitials("  Gabriel  "), "G");
  assert.equal(getLocalProfileInitials("Élodie van Dijk"), "ÉD");
});

test("saved name and avatar persist after a reload", () => {
  const storage = createMemoryStorage();
  saveLocalProfile({ displayName: "  Gabriel Melody  ", avatarId: "planet" }, storage);

  assert.deepEqual(loadLocalProfile(storage), {
    displayName: "Gabriel Melody",
    avatarId: "planet",
  });
});

test("spaces-only names are rejected", () => {
  assert.equal(isValidLocalProfileName("   "), false);
  assert.equal(isValidLocalProfileName(" Student "), true);
});

test("malformed stored profile data falls back safely", () => {
  const malformedJson = createMemoryStorage({
    [LOCAL_PROFILE_STORAGE_KEY]: "{not-json",
  });
  const malformedShape = createMemoryStorage({
    [LOCAL_PROFILE_STORAGE_KEY]: JSON.stringify({ displayName: 42, avatarId: "photo" }),
  });

  assert.deepEqual(loadLocalProfile(malformedJson), DEFAULT_LOCAL_PROFILE);
  assert.deepEqual(loadLocalProfile(malformedShape), DEFAULT_LOCAL_PROFILE);
});

test("clear all profile data removes the saved profile", () => {
  const storage = createMemoryStorage();
  saveLocalProfile({ displayName: "Mina", avatarId: "star" }, storage);

  assert.deepEqual(clearLocalProfile(storage), DEFAULT_LOCAL_PROFILE);
  assert.equal(storage.getItem(LOCAL_PROFILE_STORAGE_KEY), null);
  assert.deepEqual(loadLocalProfile(storage), DEFAULT_LOCAL_PROFILE);
});

test("appearance, task and Subject resets leave the local profile key alone", () => {
  const storage = createMemoryStorage();
  const profile = saveLocalProfile({ displayName: "Mina", avatarId: "wave" }, storage);

  ["student-hub-theme", "student-hub-tasks", "student-hub-subjects"].forEach(
    (key) => storage.removeItem(key)
  );

  assert.deepEqual(loadLocalProfile(storage), profile);
});

test("desktop and mobile identity can share the same normalized profile", () => {
  const storage = createMemoryStorage();
  const profile = saveLocalProfile({ displayName: "Ari Chen", avatarId: "book" }, storage);
  const desktopIdentity = loadLocalProfile(storage);
  const mobileIdentity = loadLocalProfile(storage);

  assert.deepEqual(desktopIdentity, profile);
  assert.deepEqual(mobileIdentity, profile);
});
