export function HeroBackground() {
  return (
    <div className="hero-bg">
      <picture style={{ pointerEvents: "none" }}>
        <source media="(min-width:1200px)" srcSet="/assets/hero_desktop.webp" />
        <source media="(min-width:600px)" srcSet="/assets/hero_tablet.webp" />
        <img
          src="/assets/hero_mobile.webp"
          alt=""
          style={{
            width: "100vw",
            height: "100vh",
            minHeight: "100dvh",
            objectFit: "cover",
            pointerEvents: "none",
          }}
        />
      </picture>
      <img
        src="/assets/texture_overlay.webp"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100vw",
          height: "100vh",
          minHeight: "100dvh",
          objectFit: "cover",
          mixBlendMode: "overlay",
          opacity: 0.12,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
