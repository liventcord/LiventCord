$(document).ready(function () {
  function handleMobileDragging() {
    var initialX = 0;
    var initialY = 0;
    var offsetX = 0;
    var offsetY = 0;
    var isDragging = false;
    var autoStabilizerTimeout;

    var draggableElement = document.getElementById("local_vid");

    draggableElement.addEventListener("touchstart", function (e) {
      clearTimeout(autoStabilizerTimeout);
      isDragging = true;
      initialX = e.touches[0].clientX - offsetX;
      initialY = e.touches[0].clientY - offsetY;
    });

    draggableElement.addEventListener("touchmove", function (e) {
      if (isDragging) {
        e.preventDefault();
        var currentX = e.touches[0].clientX - initialX;
        var currentY = e.touches[0].clientY - initialY;
        offsetX = currentX;
        offsetY = currentY;
        setTranslate(currentX, currentY, draggableElement);
      }
    });

    draggableElement.addEventListener("touchend", function () {
      isDragging = false;
      startAutoStabilizer();
    });

    function setTranslate(xPos, yPos, element) {
      element.style.transform =
        "translate3d(" + xPos + "px, " + yPos + "px, 0)";
    }
    function setTranslateBasedOnViewport(xPercent, yPercent, element) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const xPixels = (viewportWidth * xPercent) / 100;
      const yPixels = (viewportHeight * yPercent) / 100;

      element.style.transform = `translate(${xPixels}px, ${yPixels}px)`;
    }

    function startAutoStabilizer() {
      clearTimeout(autoStabilizerTimeout);
      autoStabilizerTimeout = setTimeout(function () {
        var rect = draggableElement.getBoundingClientRect();
        var screenWidth = window.innerWidth;
        var screenHeight = window.innerHeight;

        var isOutside90Percent =
          rect.left + rect.width < screenWidth * 0.1 ||
          rect.right - rect.width > screenWidth * 0.8 ||
          rect.top + rect.height < screenHeight * 0.1 ||
          rect.bottom - rect.height > screenHeight * 0.8;

        if (isOutside90Percent) {
          var newX = Math.min(Math.max(rect.left, 0), screenWidth - rect.width);
          var newY = Math.min(
            Math.max(rect.top, 0),
            screenHeight - rect.height
          );

          offsetX = newX - rect.left + offsetX;
          offsetY = newY - rect.top + offsetY;

          setTranslateBasedOnViewport(2.5, 5, draggableElement);
        }
      }, 200);
    }

    startAutoStabilizer();
  }

  function handleDesktopDragging() {
    $("#local_vid")
      .draggable({
        containment: "body",
        zIndex: 1,
        start: function (event, ui) {
          ui.position.left = $(window).width() - ui.helper.width();
          ui.position.top = $(window).height() - ui.helper.height();
        },
        drag: function (event, ui) {
          var screenWidth = $(window).width();
          var screenHeight = $(window).height();

          if (ui.position.left < 0) {
            ui.position.left = 0;
          } else if (ui.position.left + ui.helper.width() > screenWidth) {
            ui.position.left = screenWidth - ui.helper.width();
          }

          if (ui.position.top < 0) {
            ui.position.top = 0;
          } else if (ui.position.top + ui.helper.height() > screenHeight) {
            ui.position.top = screenHeight - ui.helper.height();
          }
        }
      })
      .css({
        left: $(window).width() - $("#local_vid").width(),
        top: $(window).height() - $("#local_vid").height()
      });
  }

  function checkVideoLayout() {
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      handleMobileDragging();
    } else {
      handleDesktopDragging();
    }
  }

  $(window).on("resize", function () {
    checkVideoLayout();
  });
  $(window).on("click", function () {
    checkVideoLayout();
  });
});

function checkVideoLayout() {
  const videoGrid = document.getElementById("video_grid");
  const videos = videoGrid.querySelectorAll("video");
  const videoCount = videos.length;

  videoGrid.style.display = "flex";
  videoGrid.style.flexWrap = "wrap";
  videoGrid.style.justifyContent = "center";
  videoGrid.style.alignItems = "center";

  videos.forEach((video) => {
    video.style.width = "100%";
    video.style.height = "auto";
    video.style.flex = "1 1 45%";
    video.style.maxWidth = "50%";
    video.style.zIndex = "1";
    video.style.maxHeight = "50%";
  });

  if (videoCount === 1) {
    videos[0].style.flex = "1 1 100%";
    videos[0].style.maxWidth = "100%";
    videos[0].style.maxHeight = "100%";
  } else if (videoCount === 2) {
    videos.forEach((video) => {
      video.style.flex = "1 1 50%";
      video.style.maxWidth = "50%";
      video.style.maxHeight = "100%";
    });
  } else if (videoCount === 3) {
    videos.forEach((video, index) => {
      if (index === 0) {
        video.style.flex = "1 1 100%";
        video.style.maxWidth = "100%";
        video.style.maxHeight = "50%";
      } else {
        video.style.flex = "1 1 50%";
        video.style.maxWidth = "50%";
        video.style.maxHeight = "50%";
      }
    });
  } else if (videoCount === 4) {
    videos.forEach((video) => {
      video.style.flex = "1 1 50%";
      video.style.maxWidth = "50%";
      video.style.maxHeight = "50%";
    });
  } else if (videoCount > 4) {
    const rows = Math.ceil(Math.sqrt(videoCount));
    const cols = Math.ceil(videoCount / rows);
    const videoHeight = 100 / rows;
    const videoWidth = 100 / cols;

    videos.forEach((video) => {
      video.style.flex = `1 1 ${videoWidth}%`;
      video.style.maxWidth = `${videoWidth}%`;
      video.style.maxHeight = `${videoHeight}vh`;
    });
  }

  const mediaQuery = window.matchMedia("(max-width: 768px)");
  if (mediaQuery.matches) {
    videos.forEach((video) => {
      if (video.id !== "local-vid") {
        video.style.flex = "1 1 100%";
        video.style.maxWidth = "100%";
        video.style.maxHeight = "auto";
      }
    });
  }
}

checkVideoLayout();
window.addEventListener("resize", checkVideoLayout);
window.addEventListener("click", checkVideoLayout);
