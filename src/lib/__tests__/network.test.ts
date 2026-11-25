import { describe, expect, it, jest } from "@jest/globals";
import { getNetworkStateAsync } from "expo-network";
import { isOffline } from "@/lib/network";

jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn() }));
const getState = getNetworkStateAsync as jest.MockedFunction<typeof getNetworkStateAsync>;

// isOffline must be true only for a definite "not connected". If it said "offline" when unsure,
// every Post/Join would show "No connection" while the network was fine.
describe("isOffline", () => {
  it("is true when the phone says it's not connected", async () => {
    getState.mockResolvedValueOnce({ isConnected: false });
    expect(await isOffline()).toBe(true);
  });
  it("is false when connected", async () => {
    getState.mockResolvedValueOnce({ isConnected: true });
    expect(await isOffline()).toBe(false);
  });
  it("is false when the phone isn't sure (undefined)", async () => {
    getState.mockResolvedValueOnce({ isConnected: undefined });
    expect(await isOffline()).toBe(false);
  });
  it("is false when the check itself fails", async () => {
    getState.mockRejectedValueOnce(new Error("native module unavailable"));
    expect(await isOffline()).toBe(false);
  });
});
