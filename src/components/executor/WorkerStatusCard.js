import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Zap } from "lucide-react-native";
import { WORKER_STATUS, workerStatusCopy } from "../../constants/workerStatus";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function WorkerStatusCard({ status, activeJob, onChangeStatus }) {
  const copy = workerStatusCopy[status];
  const online = status === WORKER_STATUS.AVAILABLE;

  function handleToggle() {
    onChangeStatus(online ? WORKER_STATUS.OFFLINE : WORKER_STATUS.AVAILABLE);
  }

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.iconWrap}>
          <Zap size={24} color={colors.white} fill={colors.white} strokeWidth={2.6} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{online ? "Onlaynsiz" : activeJob ? "Bandsiz" : "Oflaynsiz"}</Text>
          <Text style={styles.text}>
            {online
              ? "Yangi buyurtmalar qabul qilinyapti"
              : activeJob
                ? "Yangi buyurtmalar uchun avval faol ishni yakunlang"
                : copy.helper}
          </Text>
        </View>
        <Pressable
          disabled={Boolean(activeJob)}
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.switchTrack,
            !online && styles.switchTrackOff,
            activeJob && styles.disabled,
            pressed && styles.pressed
          ]}
        >
          <View style={[styles.switchThumb, online && styles.switchThumbOn]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    backgroundColor: "#DDFBE8",
    paddingHorizontal: 16,
    paddingVertical: 15
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: "#18B354",
    alignItems: "center",
    justifyContent: "center"
  },
  body: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  text: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600"
  },
  switchTrack: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: "#18B354",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  switchTrackOff: {
    backgroundColor: colors.subtle
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.white
  },
  switchThumbOn: {
    alignSelf: "flex-end"
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.78
  }
});
