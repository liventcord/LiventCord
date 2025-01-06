$(document).ready(function() {
    function handleMobileDragging() {
        // Variables to store initial touch position and element position
        var initialX = 0;
        var initialY = 0;
        var offsetX = 0;
        var offsetY = 0;
        var isDragging = false;
        var autoStabilizerTimeout;
    
        // Get the draggable element
        var draggableElement = document.getElementById('local_vid');
    
        // Add touch event listeners for mobile dragging
        draggableElement.addEventListener('touchstart', function(e) {
            clearTimeout(autoStabilizerTimeout);
            isDragging = true;
            initialX = e.touches[0].clientX - offsetX;
            initialY = e.touches[0].clientY - offsetY;
        });
    
        draggableElement.addEventListener('touchmove', function(e) {
            if (isDragging) {
                e.preventDefault();
                var currentX = e.touches[0].clientX - initialX;
                var currentY = e.touches[0].clientY - initialY;
                offsetX = currentX;
                offsetY = currentY;
                setTranslate(currentX, currentY, draggableElement);
            }
        });
    
        draggableElement.addEventListener('touchend', function() {
            isDragging = false;
            startAutoStabilizer();
        });
    
        function setTranslate(xPos, yPos, element) {
            element.style.transform = 'translate3d(' + xPos + 'px, ' + yPos + 'px, 0)';
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
            autoStabilizerTimeout = setTimeout(function() {
                // Check if the element is colliding with the screen borders
                var rect = draggableElement.getBoundingClientRect();
                var screenWidth = window.innerWidth;
                var screenHeight = window.innerHeight;
        
                var isOutside90Percent = (
                    rect.left + rect.width < screenWidth * 0.1 ||
                    rect.right - rect.width > screenWidth * 0.8 ||
                    rect.top + rect.height < screenHeight * 0.1 ||
                    rect.bottom - rect.height > screenHeight * 0.8
                );
        
                if (isOutside90Percent) {
                    var newX = Math.min(Math.max(rect.left, 0), screenWidth - rect.width);
                    var newY = Math.min(Math.max(rect.top, 0), screenHeight - rect.height);
        
                    offsetX = newX - rect.left + offsetX; // Update offsetX
                    offsetY = newY - rect.top + offsetY; // Update offsetY

                    setTranslateBasedOnViewport(2.5, 5, draggableElement);
                }
            }, 200); 
        }
        
    
        // Start the auto stabilizer initially
        startAutoStabilizer();
    }
    
    


    // Function to handle desktop dragging
    function handleDesktopDragging() {
        // Use jQuery UI draggable for desktop dragging
        $('#local_vid').draggable({
            containment: 'body',
            zIndex: 1,
            // set start position at bottom right
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
        }).css({
            // Set initial position
            left: $(window).width() - $('#local_vid').width(),
            top: $(window).height() - $('#local_vid').height()
        });

        
    }

    // Function to check and update video layout based on device type
    function checkVideoLayout() {
        var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            handleMobileDragging();
        } else {
            handleDesktopDragging();

        }
    }


    $(window).on('resize', function() {
        checkVideoLayout();
    });
    $(window).on('click', function() {
        checkVideoLayout();
    });
    


    
    
});






function checkVideoLayout() {
    const videoGrid = document.getElementById("video_grid");
    const videos = videoGrid.querySelectorAll("video");
    const videoCount = videos.length;

    videoGrid.style.display = 'flex';
    videoGrid.style.flexWrap = 'wrap';
    videoGrid.style.justifyContent = 'center';
    videoGrid.style.alignItems = 'center';

    videos.forEach(video => {
        video.style.width = '100%'; // Ensure videos take full width initially
        video.style.height = 'auto'; // Allow height to adjust according to aspect ratio
        video.style.flex = '1 1 45%'; // Base size, adjusted for 2x2 grid or similar
        video.style.maxWidth = '50%';
        video.style.zIndex = '1';
        video.style.maxHeight = '50%';
    });

    if (videoCount === 1) {
        videos[0].style.flex = '1 1 100%';
        videos[0].style.maxWidth = '100%';
        videos[0].style.maxHeight = '100%';
    } else if (videoCount === 2) {
        videos.forEach(video => {
            video.style.flex = '1 1 50%';
            video.style.maxWidth = '50%';
            video.style.maxHeight = '100%';
        });
    } else if (videoCount === 3) {
        videos.forEach((video, index) => {
            if (index === 0) {
                video.style.flex = '1 1 100%';
                video.style.maxWidth = '100%';
                video.style.maxHeight = '50%';
            } else {
                video.style.flex = '1 1 50%';
                video.style.maxWidth = '50%';
                video.style.maxHeight = '50%';
            }
        });
    } else if (videoCount === 4) {
        videos.forEach(video => {
            video.style.flex = '1 1 50%';
            video.style.maxWidth = '50%';
            video.style.maxHeight = '50%';
        });
    } else if (videoCount > 4) {
        // Calculate grid dimensions dynamically for more than 4 videos
        const rows = Math.ceil(Math.sqrt(videoCount));
        const cols = Math.ceil(videoCount / rows);
        const videoHeight = 100 / rows;
        const videoWidth = 100 / cols;

        videos.forEach(video => {
            video.style.flex = `1 1 ${videoWidth}%`;
            video.style.maxWidth = `${videoWidth}%`;
            video.style.maxHeight = `${videoHeight}vh`;
        });
    }

    // Media query for smaller screens
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    if (mediaQuery.matches) {
        videos.forEach(video => {
            if(video.id !== 'local-vid') {
                video.style.flex = '1 1 100%'; // Full width for single video
                video.style.maxWidth = '100%';
                video.style.maxHeight = 'auto'; // Allow height to adjust based on content

            }
        });
    }
}

checkVideoLayout();
window.addEventListener('resize', checkVideoLayout);
window.addEventListener('click', checkVideoLayout);
