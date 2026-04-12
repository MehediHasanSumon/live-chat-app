import { create } from "zustand";

import {
  type CallRoomApiItem,
  type CallSignalPayload,
  type JoinCallApiPayload,
  getCallParticipant,
  isCallTerminal,
} from "@/lib/calls-data";

type CallSession = {
  callRoom: CallRoomApiItem;
  token: JoinCallApiPayload["token"] | null;
  publishMode: JoinCallApiPayload["publish_mode"] | null;
  source: "incoming" | "outgoing" | "synced";
};

type CallStoreState = {
  incomingCall: CallSession | null;
  activeCall: CallSession | null;
  isRoomOpen: boolean;
  receiveIncomingCall: (payload: CallSignalPayload) => void;
  hydrateCallRoom: (callRoom: CallRoomApiItem, userId: number) => void;
  syncCallState: (payload: CallSignalPayload) => void;
  setOutgoingCall: (callRoom: CallRoomApiItem) => void;
  setJoinedCall: (payload: JoinCallApiPayload, source?: CallSession["source"]) => void;
  openRoom: () => void;
  minimizeRoom: () => void;
  clearIncomingCall: () => void;
  clearActiveCall: () => void;
};

function mergeSession(
  current: CallSession | null,
  callRoom: CallRoomApiItem,
  source: CallSession["source"],
): CallSession {
  return {
    callRoom,
    token: current?.token ?? null,
    publishMode: current?.publishMode ?? null,
    source,
  };
}

export const useCallStore = create<CallStoreState>((set) => ({
  incomingCall: null,
  activeCall: null,
  isRoomOpen: false,
  receiveIncomingCall: ({ call_room }) =>
    set((state) => ({
      incomingCall: {
        callRoom: call_room,
        token: null,
        publishMode: null,
        source: "incoming",
      },
      activeCall:
        state.activeCall?.callRoom.room_uuid === call_room.room_uuid
          ? mergeSession(state.activeCall, call_room, state.activeCall.source)
          : state.activeCall,
    })),
  hydrateCallRoom: (callRoom, userId) =>
    set((state) => {
      const participant = getCallParticipant(callRoom, userId);

      if (!participant || isCallTerminal(callRoom)) {
        return {
          incomingCall:
            state.incomingCall?.callRoom.room_uuid === callRoom.room_uuid ? null : state.incomingCall,
          activeCall:
            state.activeCall?.callRoom.room_uuid === callRoom.room_uuid ? null : state.activeCall,
        };
      }

      if (["invited", "ringing"].includes(participant.invite_status)) {
        return {
          incomingCall: {
            callRoom,
            token: null,
            publishMode: null,
            source: "incoming",
          },
          activeCall:
            state.activeCall?.callRoom.room_uuid === callRoom.room_uuid
              ? mergeSession(state.activeCall, callRoom, state.activeCall.source)
              : state.activeCall,
        };
      }

      if (participant.invite_status === "accepted") {
        return {
          incomingCall:
            state.incomingCall?.callRoom.room_uuid === callRoom.room_uuid ? null : state.incomingCall,
          activeCall: {
            callRoom,
            token:
              state.activeCall?.callRoom.room_uuid === callRoom.room_uuid ? state.activeCall.token : null,
            publishMode:
              state.activeCall?.callRoom.room_uuid === callRoom.room_uuid ? state.activeCall.publishMode : null,
            source:
              state.activeCall?.callRoom.room_uuid === callRoom.room_uuid
                ? state.activeCall.source
                : "synced",
          },
        };
      }

      return state;
    }),
  syncCallState: ({ call_room }) =>
    set((state) => {
      const nextIncoming =
        state.incomingCall?.callRoom.room_uuid === call_room.room_uuid && !isCallTerminal(call_room)
          ? mergeSession(state.incomingCall, call_room, state.incomingCall.source)
          : state.incomingCall?.callRoom.room_uuid === call_room.room_uuid
            ? null
            : state.incomingCall;

      const nextActive =
        state.activeCall?.callRoom.room_uuid === call_room.room_uuid
          ? isCallTerminal(call_room)
            ? null
            : mergeSession(state.activeCall, call_room, state.activeCall.source)
          : state.activeCall;

      return {
        incomingCall: nextIncoming,
        activeCall: nextActive,
      };
    }),
  setOutgoingCall: (callRoom) =>
    set({
      activeCall: {
        callRoom,
        token: null,
        publishMode: null,
        source: "outgoing",
      },
      isRoomOpen: false,
    }),
  setJoinedCall: (payload, source = "synced") =>
    set({
      activeCall: {
        callRoom: payload.call_room,
        token: payload.token,
        publishMode: payload.publish_mode,
        source,
      },
      incomingCall: null,
      isRoomOpen: true,
    }),
  openRoom: () => set({ isRoomOpen: true }),
  minimizeRoom: () => set({ isRoomOpen: false }),
  clearIncomingCall: () => set({ incomingCall: null }),
  clearActiveCall: () => set({ activeCall: null, incomingCall: null, isRoomOpen: false }),
}));
