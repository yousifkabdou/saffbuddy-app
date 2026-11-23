import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Alert, Linking, Platform } from "react-native";
import { Room } from "@/data/room";
import { openDirections } from "@/lib/directions";

const room = { latitude: 40.0, longitude: -83.0 } as Room;
const GOOGLE = "https://www.google.com/maps/dir/?api=1&destination=40,-83&travelmode=walking";
const APPLE = "https://maps.apple.com/?daddr=40,-83&dirflg=w";

describe("openDirections", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  it("Android: opens walking directions in Google Maps", () => {
    jest.replaceProperty(Platform, "OS", "android");
    openDirections(room);
    expect(Linking.openURL).toHaveBeenCalledWith(GOOGLE);
  });

  it("iOS: asks which app, and each choice opens the right URL", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    openDirections(room);
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => b.text)).toEqual(["Apple Maps", "Google Maps", "Cancel"]);
    buttons[0].onPress!();
    expect(Linking.openURL).toHaveBeenLastCalledWith(APPLE);
    buttons[1].onPress!();
    expect(Linking.openURL).toHaveBeenLastCalledWith(GOOGLE);
  });
});
