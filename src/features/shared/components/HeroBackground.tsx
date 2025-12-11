export function HeroBackground() {
  return (
    <div className="hero-bg">
      <picture>
        <source media="(min-width:1200px)" srcSet="/assets/hero_desktop.png" />
        <source media="(min-width:600px)" srcSet="/assets/hero_tablet.png" />
        <img
          src="/assets/hero_mobile.png"
          alt=""
          style={{
            width: "100vw",
            height: "100vh",
            minHeight: "100dvh",
            objectFit: "cover",
          }}
        />
      </picture>
      <img
        src="/assets/texture_overlay.png"
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
