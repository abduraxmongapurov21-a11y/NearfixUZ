import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pause, Play } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text } from "../../i18n/native";
import { colors, font } from "../../theme/clientTheme";
import { ROUTES } from "../../constants/routes";
import { bannersForPlacement, nextBannerIndex, resolveBannerTarget } from "../../services/content/bannerModel.mjs";

function BannerVideo({ uri, playing, onError }) {
  const player = useVideoPlayer(uri, (video) => {
    video.muted = true;
    video.loop = true;
  });
  useEffect(() => { if (playing) player.play(); else player.pause(); }, [player, playing]);
  const { status } = useEvent(player, "statusChange", { status: player.status });
  useEffect(() => { if (status === "error") onError(); }, [onError, status]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" surfaceType="textureView"
    nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} playsInline pointerEvents="none" />;
}

function BannerSlide({ banner, width, current, playing, target, onPress, isHome }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width, paddingHorizontal: 1 }}>
      <Pressable accessibilityRole={target ? "link" : undefined} accessibilityLabel={banner.title} disabled={!target}
        onPress={onPress} style={[styles.card, isHome && styles.heroCard]}>
        {!failed && banner.imageUrl ? banner.mediaType === "VIDEO" ? (
          current ? <BannerVideo uri={banner.imageUrl} playing={playing} onError={() => setFailed(true)} /> : null
        ) : <Image source={{ uri: banner.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} /> : null}
        <View pointerEvents="none" style={styles.scrim} />
        <Text style={styles.adLabel}>Reklama</Text>
        <Text translate={false} numberOfLines={2} style={[styles.title, isHome && styles.heroTitle]}>{banner.title}</Text>
      </Pressable>
    </View>
  );
}

export function BannerCarousel({ banners, categories, navigation, placement }) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const scroll = useRef(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const isHome = placement === "HOME";
  const activeBanners = bannersForPlacement(banners, placement);
  const identity = activeBanners.map((banner) => `${banner.id}:${banner.imageUrl}`).join("|");
  const canPlay = isFocused && foreground && !paused && !reduceMotion && !dragging;
  const currentMediaType = activeBanners[index]?.mediaType;
  const motionPaused = paused || reduceMotion;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const app = AppState.addEventListener("change", (value) => setForeground(value === "active"));
    return () => { alive = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    setIndex(0);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [identity, width]);

  useEffect(() => {
    if (!canPlay || width <= 0 || activeBanners.length < 2) return undefined;
    const timer = setTimeout(() => {
      const next = nextBannerIndex(index, activeBanners.length);
      setIndex(next);
      scroll.current?.scrollTo({ x: next * width, animated: true });
    }, currentMediaType === "VIDEO" ? 12000 : 6000);
    return () => clearTimeout(timer);
  }, [canPlay, index, width, identity, activeBanners.length, currentMediaType]);

  async function openBanner(target) {
    if (target?.kind === "category") navigation.navigate(ROUTES.CATEGORY, { categoryId: target.categoryId });
    if (target?.kind === "url") {
      try { await Linking.openURL(target.url); } catch { /* Keep the catalog usable if the URL cannot open. */ }
    }
  }

  if (!activeBanners.length) return null;
  return (
    <View style={[styles.container, isHome && styles.heroContainer]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)} onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={(event) => {
          setDragging(false);
          if (width > 0) setIndex(Math.max(0, Math.min(activeBanners.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))));
        }}>
        {width > 0 ? activeBanners.map((banner, itemIndex) => {
          const target = resolveBannerTarget(banner, categories);
          return <BannerSlide key={`${banner.id}:${banner.mediaType}:${banner.imageUrl}`} banner={banner} width={width} isHome={isHome}
            current={itemIndex === index} playing={canPlay && itemIndex === index} target={target} onPress={() => openBanner(target)} />;
        }) : null}
      </ScrollView>
      {activeBanners.length > 1 || activeBanners[0]?.mediaType === "VIDEO" ? (
        <View pointerEvents="box-none" style={styles.controls}>
          <View style={styles.dots}>{activeBanners.map((banner, itemIndex) => <View key={banner.id} style={[styles.dot, index === itemIndex && styles.activeDot]} />)}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(motionPaused ? "Reklamani davom ettirish" : "Reklamani to'xtatish")}
            onPress={() => { setPaused(!motionPaused); setReduceMotion(false); }} style={styles.pause}>
            {motionPaused ? <Play size={13} color={colors.white} /> : <Pause size={13} color={colors.white} />}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 22, marginTop: 12 },
  card: { height: 64, borderRadius: 14, overflow: "hidden", backgroundColor: colors.primaryDark, padding: 12, justifyContent: "center" },
  heroContainer: { marginTop: 20 },
  heroCard: { height: 200, borderRadius: 25, padding: 22, paddingBottom: 30, justifyContent: "flex-end" },
  heroTitle: { fontSize: 23, lineHeight: 30 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,35,43,0.66)" },
  adLabel: { position: "absolute", top: 6, right: 10, fontFamily: font.medium, fontSize: 9, color: colors.white, opacity: 0.9 },
  title: { color: colors.white, fontSize: 14, lineHeight: 18, paddingRight: 44, fontFamily: font.bold, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  controls: { ...StyleSheet.absoluteFillObject, alignItems: "center" },
  dots: { position: "absolute", bottom: 5, flexDirection: "row", gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  activeDot: { width: 16, backgroundColor: colors.white },
  pause: { position: "absolute", right: 1, bottom: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center" }
});
