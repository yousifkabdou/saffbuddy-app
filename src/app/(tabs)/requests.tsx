import { useSharedRequests } from "@/context/RequestsContext";
import { colors } from "@/theme";
import { PrayerRequest } from "@/data/request";
import { openDirections } from "@/lib/directions";
import { formatTime, isInProgress } from "@/lib/requestTime";
import { RoomGroup, sortRooms } from "@/lib/sortRooms";
import { otherPerson } from "@/lib/wording";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import TitlePill, { useTitleSpace } from "@/components/TitlePill";

// Every room the user can see, grouped with its requests, busiest room first (see sortRooms).
export default function Requests() {
  const { rooms, requests, now, setOpenRoomId, focusRoomId, setFocusRoomId } = useSharedRequests();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight(); // the tab bar floats over the screen
  const listTop = useTitleSpace(); // space the floating title covers
  const scrollRef = useRef<ScrollViewInstance | null>(null); // the list itself, so code can scroll it
  // Where each room's section starts inside the list (in px from the top), by room id.
  // A ref, not state: it changes on every layout and nothing needs to re-render when it does.
  const sectionY = useRef<Record<string, number>>({});

  // Rooms the user collapsed. We store the collapsed ones (not the open ones) so the default
  // is "open": a room that gets its first request while you're looking is open automatically.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Every time the user leaves this tab, open every room again, so it's reset when they come back.
  // Resetting on leave (the cleanup) rather than on arrival means the layout is already final when
  // the tab appears, so scrolling to a room from the map lands in the right place.
  // useCallback keeps the same function between renders; without it the effect would re-run every render.
  useFocusEffect(useCallback(() => {
    return () => setCollapsed(new Set());
  }, []));

  // Scroll to the room the map asked for (focusRoomId), then clear it so it only happens once.
  // If that room hasn't been laid out yet (first visit to this tab), its onLayout below does it instead.
  const scrollToFocusRoom = () => {
    if (!focusRoomId) return;
    const y = sectionY.current[focusRoomId];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: y - listTop, animated: true }); // land just below the floating title
    setFocusRoomId(null);
  };
  useEffect(scrollToFocusRoom, [focusRoomId, listTop, setFocusRoomId]);

  // A Set is changed by making a new one: React only re-renders when state is a new object.
  const toggle = (roomId: string) => {
    setCollapsed((old) => {
      const next = new Set(old);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const groups = sortRooms(rooms, requests, now);
  const anyRequests = groups.some((g) => g.requests.length > 0);

  return (
    <View style={styles.screen}>
    <ScrollView ref={scrollRef} contentContainerStyle={{ paddingTop: listTop, paddingBottom: tabBarHeight + 16 }}>
      {!anyRequests && rooms.length > 0 &&
      <Text style={styles.emptyAll}>No requests right now. Post one from a room on the map.</Text>}

      {groups.map((group) => (
        <RoomSection
          key={group.room.id}
          group={group}
          open={!collapsed.has(group.room.id)}
          onToggle={() => toggle(group.room.id)}
          // Empty room: go to the map with this room's panel open, so the user can post a request there.
          onOpenOnMap={() => {
            setOpenRoomId(group.room.id);
            router.navigate("/");
          }}
          onLayout={(y) => {
            sectionY.current[group.room.id] = y;
            if (group.room.id === focusRoomId) scrollToFocusRoom();
          }}
        />
      ))}
    </ScrollView>
    {/* Floating liquid glass title; the cards scroll underneath it. */}
    <TitlePill title="Requests" />
    </View>
  );
}

// One room: a header like the map panel's, then its requests when open.
function RoomSection({ group, open, onToggle, onOpenOnMap, onLayout }: {
  group: RoomGroup;
  open: boolean;
  onToggle: () => void;
  onOpenOnMap: () => void;
  onLayout: (y: number) => void; // reports where this section starts in the list
}) {
  const { room, requests } = group;
  const hasRequests = requests.length > 0;

  return (
    // White card floating over the grey screen.
    <View style={styles.section} onLayout={(e) => onLayout(e.nativeEvent.layout.y)}>
      {/* Rooms with requests collapse/expand. Empty rooms have no chevron; tapping opens the room on the map. */}
      <Pressable style={styles.header} onPress={hasRequests ? onToggle : onOpenOnMap}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{room.building}</Text>
          <Text style={styles.description}>{`${room.floor}, Room ${room.room_num}`}</Text>
          {!hasRequests && <Text style={styles.emptyRoom}>(No requests, click on location to request)</Text>}
        </View>
        {hasRequests &&
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.grey} style={styles.chevron} />}
        <Pressable style={styles.directionsButton} onPress={() => openDirections(room)}>
          <Ionicons name="location" size={22} color={colors.scarlet} />
        </Pressable>
      </Pressable>

      {open && requests.map((request) => <RequestRow key={request.id} request={request} />)}
    </View>
  );
}

// One request: start time and member count on the left, the action that fits on the right.
function RequestRow({ request }: { request: PrayerRequest }) {
  const {
    now, gender, counts, myRequestId, myJoinedId, doneId, markDone,
    handleJoin, cancelRequest, leaveRequest,
  } = useSharedRequests();

  const isMine = request.id === myRequestId;
  const isJoined = request.id === myJoinedId;
  const inProgress = isInProgress(request.start_time, now);
  const joiners = counts[request.id] ?? 0; // counts holds joiners only

  // Same warnings as the panel. A list has no room for an in-panel confirm, so use an alert.
  // Cancel only warns when someone joined; with no joiners, cancelling affects nobody.
  const confirmCancel = () => {
    if (joiners === 0) {
      cancelRequest();
      return;
    }
    Alert.alert("Cancel your request?", `You're cancelling on ${otherPerson(gender)}. Be considerate of others' time.`, [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: cancelRequest },
    ]);
  };

  const confirmLeave = () => {
    Alert.alert("Leave this request?", `Remember, ${otherPerson(gender)} is expecting you.`, [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: leaveRequest },
    ]);
  };

  // Which action this row gets. Order matters: "finished" wins over "in progress", which wins over "pending".
  let action;
  if ((isMine || isJoined) && request.id === doneId) {
    // Tapped Done: others may still be praying, so the row stays, but the user is finished.
    action = <Text style={styles.finishingText}>Finishing up</Text>;
  } else if ((isMine || isJoined) && inProgress) {
    action = (
      <Pressable style={[styles.actionButton, styles.doneButton]} onPress={() => markDone(request.id)}>
        <Text style={styles.actionText}>Done</Text>
      </Pressable>
    );
  } else if (isMine) {
    action = (
      <Pressable style={[styles.actionButton, styles.redButton]} onPress={confirmCancel}>
        <Text style={styles.actionText}>Cancel</Text>
      </Pressable>
    );
  } else if (isJoined) {
    action = (
      <Pressable style={[styles.actionButton, styles.redButton]} onPress={confirmLeave}>
        <Text style={styles.actionText}>Leave</Text>
      </Pressable>
    );
  } else if (inProgress) {
    // Past the join cutoff nobody can join (the joiners insert policy refuses it too).
    action = <Text style={styles.inProgressText}>In progress</Text>;
  } else {
    // handleJoin shows an alert instead if the user is already in a request.
    action = (
      <Pressable style={styles.actionButton} onPress={() => handleJoin(request.id)}>
        <Text style={styles.actionText}>Join</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.time}>
          {isMine && <Text style={styles.bold}>Yours · </Text>}
          {isJoined && <Text style={styles.bold}>Joined · </Text>}
          {formatTime(request.start_time)}
        </Text>
        {/* + 1 adds the requester */}
        <Text style={styles.members}>Total members: {joiners + 1}</Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background, // grey, so the glass room cards stand out
  },
  emptyAll: {
    color: colors.grey,
    textAlign: "center",
    marginTop: 16,
    marginHorizontal: 20,
  },
  section: {
    // Each room is its own rounded white card with space around it, lifted by a soft shadow.
    backgroundColor: colors.paper,
    borderRadius: 20,
    shadowColor: "black",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,               // take the space left of the buttons; long names wrap
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.scarlet,
  },
  description: {
    color: colors.grey,
    marginTop: 2,
  },
  emptyRoom: {
    color: colors.grey,
    fontStyle: "italic",
    marginTop: 2,
  },
  chevron: {
    marginHorizontal: 8,
  },
  directionsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  time: {
    fontSize: 16,
  },
  bold: {
    fontWeight: "bold",
  },
  members: {
    color: colors.grey,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.ink,
  },
  redButton: {
    backgroundColor: colors.scarlet,
  },
  doneButton: {
    backgroundColor: colors.success,
  },
  actionText: {
    color: colors.paper,
    fontWeight: "bold",
  },
  inProgressText: {
    color: colors.success,
    fontWeight: "bold",
  },
  finishingText: {
    color: colors.greyLight,
    fontWeight: "bold",
  },
});
