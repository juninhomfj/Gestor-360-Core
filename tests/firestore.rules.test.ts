// tests/firestore.rules.test.ts
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "fs";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "gestor360-app",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore security rules", () => {
  it("should allow authenticated users to read from commission_basic", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "commission_basic/testDoc"), {
        isActive: true,
      });
    });

    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const testDoc = doc(aliceDb, "commission_basic/testDoc");
    await assertSucceeds(getDoc(testDoc));
  });

  it("should not allow unauthenticated users to read from commission_basic", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const testDoc = doc(unauthedDb, "commission_basic/testDoc");
    await assertFails(getDoc(testDoc));
  });
});
