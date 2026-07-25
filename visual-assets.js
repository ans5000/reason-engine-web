(() => {
  async function decodeBase64Image(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Bildquelle nicht geladen: ${path}`);

    const encoded = (await response.text()).trim();
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
  }

  async function applyVisuals() {
    const hero = document.querySelector(".hero-art");
    const city = document.querySelector("[data-city-visual]");

    try {
      const heroUrl = await decodeBase64Image("assets/journey.webp.b64");
      if (hero) hero.style.backgroundImage = `url("${heroUrl}")`;
    } catch (error) {
      console.warn(error);
    }

    try {
      const cityUrl = await decodeBase64Image("assets/city.webp.b64");
      if (city) city.src = cityUrl;
    } catch (error) {
      console.warn(error);
    }
  }

  applyVisuals();
})();
