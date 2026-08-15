/**
 * Site interactions and quality-preserving lazy media loading.
 */
(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const transparentPixel =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  function initAos() {
    if (window.AOS && !reducedMotion.matches) {
      AOS.init({
        duration: 600,
        easing: "ease-in-out",
        once: true,
        mirror: false,
      });
      document.documentElement.classList.remove("no-js");
      document.documentElement.classList.add("aos-enabled");
    }
  }

  function loadVideo(video) {
    if (video.dataset.loaded === "true" || saveData) return;

    video.querySelectorAll("source[data-src]").forEach((source) => {
      source.src = source.dataset.src;
    });
    video.load();
    video.dataset.loaded = "true";
  }

  function playVideo(video) {
    loadVideo(video);
    if (saveData || reducedMotion.matches || video.dataset.loaded !== "true") return;
    video.play().catch(() => {
      // Autoplay can still be denied by a browser or device policy.
    });
  }

  function activateImage(image) {
    const source =
      reducedMotion.matches || saveData
        ? image.dataset.staticSrc || image.dataset.src
        : image.dataset.src;
    if (source && image.getAttribute("src") !== source) image.src = source;
  }

  function deactivateAnimatedImage(image) {
    if (!image.dataset.src || reducedMotion.matches || saveData) return;
    image.src = transparentPixel;
  }

  function initLazyMedia() {
    const videos = [...document.querySelectorAll("video.lazy-video")];
    const lazyImages = [...document.querySelectorAll("img[data-src]")];
    const lazyObjects = [...document.querySelectorAll("object[data-src]")];

    if (!("IntersectionObserver" in window)) {
      videos.forEach(loadVideo);
      lazyImages.forEach(activateImage);
      lazyObjects.forEach((object) => {
        object.data = object.dataset.src;
      });
      return;
    }

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.matches("video")) loadVideo(entry.target);
            if (entry.target.matches("img")) activateImage(entry.target);
            if (entry.target.matches("object") && !entry.target.hasAttribute("data")) {
              entry.target.data = entry.target.dataset.src;
              preloadObserver.unobserve(entry.target);
            }
          } else if (entry.target.matches("img.lazy-animated-image")) {
            deactivateAnimatedImage(entry.target);
          }
        });
      },
      { rootMargin: "300px 0px" }
    );

    [...videos, ...lazyImages, ...lazyObjects].forEach((element) => {
      preloadObserver.observe(element);
    });

    const playbackObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          const carouselItem = video.closest(".carousel-item");
          const activeSlide = !carouselItem || carouselItem.classList.contains("active");

          if (entry.isIntersecting && activeSlide) {
            playVideo(video);
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.25 }
    );

    videos.forEach((video) => playbackObserver.observe(video));

    document.querySelectorAll(".carousel").forEach((carousel) => {
      carousel.addEventListener("slide.bs.carousel", () => {
        carousel.querySelectorAll("video").forEach((video) => video.pause());
      });
      carousel.addEventListener("slid.bs.carousel", () => {
        const video = carousel.querySelector(".carousel-item.active video");
        if (video) {
          const bounds = video.getBoundingClientRect();
          if (bounds.bottom > 0 && bounds.top < window.innerHeight) playVideo(video);
        }
      });
    });
  }

  function initYouTubeFacades() {
    document.querySelectorAll(".youtube-facade[data-youtube-id]").forEach((facade) => {
      const button = facade.querySelector("button");
      if (!button) return;

      button.addEventListener("click", () => {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${facade.dataset.youtubeId}?autoplay=1`;
        iframe.title = facade.dataset.title || "YouTube video player";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        facade.replaceChildren(iframe);
      });
    });
  }

  function initBackToTop() {
    const backToTop = document.querySelector(".back-to-top");
    if (!backToTop) return;

    const updateVisibility = () => {
      backToTop.classList.toggle("active", window.scrollY > 100);
    };

    window.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
  }

  function init() {
    initAos();
    initLazyMedia();
    initYouTubeFacades();
    initBackToTop();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
