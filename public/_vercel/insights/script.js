(() => {
  const STYLE_ID = "sn-layout-hotfix-20260809";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 901px) {
        .home-hero {
          min-height: 610px !important;
        }

        .home-hero-copy {
          padding-top: 72px !important;
        }

        .sn-bollard-offer {
          width: min(610px, 100%) !important;
          min-height: 46px !important;
          margin-top: 11px !important;
          padding: 7px 12px !important;
          grid-template-columns: 34px minmax(0, 1fr) 18px !important;
          gap: 10px !important;
          border-radius: 10px !important;
        }

        .sn-bollard-offer > span:first-child {
          width: 34px !important;
          height: 34px !important;
          font-size: 12px !important;
        }

        .sn-bollard-offer strong {
          overflow: hidden !important;
          font-size: 13px !important;
          line-height: 1.35 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .sn-bollard-offer small {
          display: block !important;
          overflow: hidden !important;
          margin-top: 1px !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .sn-bollard-offer b {
          font-size: 20px !important;
        }
      }

      @media (max-width: 900px) {
        .sn-bollard-offer {
          display: none !important;
        }
      }

      body .hero #hero-title {
        max-width: 720px !important;
        font-size: clamp(40px, 3.8vw, 56px) !important;
        line-height: 1.1 !important;
        letter-spacing: -0.045em !important;
        word-break: keep-all !important;
      }

      body .hero #hero-title .sn-title-line {
        display: block;
        white-space: nowrap;
      }

      @media (max-width: 680px) {
        body .hero #hero-title {
          font-size: clamp(34px, 10.2vw, 44px) !important;
          line-height: 1.12 !important;
        }

        body .hero #hero-title .sn-title-line {
          white-space: normal;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const offer = document.querySelector(".sn-bollard-offer");
  if (offer) {
    const title = offer.querySelector("strong");
    const description = offer.querySelector("small");
    if (title) title.textContent = "볼라드 설치·파손 교체 상담";
    if (description) description.textContent = "현장사진·지역·수량으로 빠른 견적 확인";
  }

  if (location.pathname === "/bollard" || location.pathname === "/bollard/") {
    const title = document.getElementById("hero-title");
    if (title) {
      title.innerHTML = [
        '<span class="sn-title-line">주차장·공장·상가</span>',
        '<span class="sn-title-line">볼라드 제작·교체·시공</span>'
      ].join("");
    }
  }
})();
