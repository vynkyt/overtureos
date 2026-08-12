/////////////////////////// DRAG START ///////////////////////////

function dragElement(element) {
    if (!element) return;

    var initialX = 0;
    var initialY = 0;
    var currentX = 0;
    var currentY = 0;

    // If the window has a header, drag using the header
    var header = document.getElementById(element.id + "header");

    if (header) {
        header.onmousedown = startDragging;
    } else {
        element.onmousedown = startDragging;
    }

    function startDragging(e) {
        e = e || window.event;
        e.preventDefault();

        initialX = e.clientX;
        initialY = e.clientY;

        // Bring window to front
        handleWindowTap(element);

        document.onmouseup = stopDragging;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();

        // Calculate mouse movement
        currentX = initialX - e.clientX;
        currentY = initialY - e.clientY;

        initialX = e.clientX;
        initialY = e.clientY;

        // Move the element
        element.style.top =
            (element.offsetTop - currentY) + "px";

        element.style.left =
            (element.offsetLeft - currentX) + "px";
    }

    function stopDragging() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}


/////////////////////////// WINDOW OPEN / CLOSE ///////////////////////////

var biggestIndex = 1;

var topBar = document.querySelector("#top");


function openWindow(element) {
    if (!element) return;

    element.style.display = "flex";

    biggestIndex++;
    element.style.zIndex = biggestIndex;


    if (topBar) {
        topBar.style.zIndex = biggestIndex + 1;
    }
}

function toggleWindow(element) {
    if (!element) return;

    var targetName = element.getAttribute("data-window");

    if (!targetName) return;

    var targetWindow = document.getElementById(targetName);

    if (!targetWindow) return;

    var isOpen = window.getComputedStyle(targetWindow).display !== "none";

    if (isOpen) {
        closeWindow(targetWindow);
    } else {
        openWindow(targetWindow);
    }
}


function closeWindow(element) {
    if (!element) return;

    var windowElement = element.closest(".window");

    if (windowElement) {
        windowElement.style.display = "none";
    }
}


/////////////////////////// WINDOW Z-INDEX ///////////////////////////

function handleWindowTap(element) {
    if (!element) return;

    biggestIndex++;

    element.style.zIndex = biggestIndex;

    if (topBar) {
        topBar.style.zIndex = biggestIndex + 1;
    }

    // Deselect any selected desktop icon
    deselectIcon(selectedIcon);
}


function addWindowTapHandling(element) {
    if (!element) return;

    element.addEventListener("mousedown", function () {
        handleWindowTap(element);
    });
}


/////////////////////////// CLOSE BUTTONS ///////////////////////////

function makeClosable(elementName) {
    var windowElement = document.querySelector("#" + elementName);

    if (!windowElement) return;

    var closeButton =
        windowElement.querySelector(".closewindow");

    if (!closeButton) return;

    closeButton.addEventListener("click", function (e) {
        e.stopPropagation();
        closeWindow(closeButton);
    });
}


var closeButtons =
    document.querySelectorAll(".closewindow");


closeButtons.forEach(function (button) {
    button.addEventListener("click", function (e) {
        e.stopPropagation();
        closeWindow(button);
    });
});


/////////////////////////// OPEN BUTTONS ///////////////////////////

var openButtons =
    document.querySelectorAll(".openwindow");

openButtons.forEach(function (button) {

    button.addEventListener("click", function (e) {
        e.stopPropagation();

        toggleWindow(button);
    });

});



/////////////////////////// APPS START ///////////////////////////

var selectedIcon = undefined;


function selectIcon(element) {
    if (!element) return;

    // Deselect previously selected icon
    if (selectedIcon && selectedIcon !== element) {
        selectedIcon.classList.remove("selected");
    }

    element.classList.add("selected");

    selectedIcon = element;
}


function deselectIcon(element) {
    if (element) {
        element.classList.remove("selected");
    }

    selectedIcon = undefined;
}


function handleIconTap(element) {
    if (!element) return;

    if (element.classList.contains("selected")) {

        // Second click = open the window
        deselectIcon(element);

        var targetName =
            element.getAttribute("data-window");

        if (targetName) {
            var targetWindow =
                document.getElementById(targetName);

            openWindow(targetWindow);
        }

    } else {

        // First click = select icon
        selectIcon(element);
    }
}


/////////////////////////// ICON INITIALISATION ///////////////////////////

var appIcons =
    document.querySelectorAll(".appicon");


appIcons.forEach(function (icon) {
    icon.addEventListener("click", function (e) {
        e.stopPropagation();
        handleIconTap(icon);
    });
});


/////////////////////////// WINDOW INITIALISATION ///////////////////////////

function initializeWindow(elementName) {

    var screen =
        document.querySelector("#" + elementName);

    if (!screen) {
        console.warn(
            "Window not found: #" + elementName
        );
        return;
    }

    // Allow window to come to front when clicked
    addWindowTapHandling(screen);

    // Add close functionality
    makeClosable(elementName);

    // Make window draggable
    dragElement(screen);
}


/////////////////////////// INITIALISE YOUR WINDOWS ///////////////////////////

initializeWindow("photobook");
initializeWindow("about");
initializeWindow("videoarchive");


/////////////////////////// RESIZE START ///////////////////////////

document.querySelectorAll(".window").forEach(windowEl => {

  const directions = [
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right"
  ];

  directions.forEach(direction => {
    const handle = document.createElement("div");

    handle.className = `window-resize ${direction}`;
    handle.dataset.direction = direction;

    windowEl.appendChild(handle);
  });

  let resizing = false;
  let direction = "";

  let startX = 0;
  let startY = 0;

  let startWidth = 0;
  let startHeight = 0;

  let startLeft = 0;
  let startTop = 0;

  const minWidth = 260;
  const minHeight = 180;

  windowEl.querySelectorAll(".window-resize").forEach(handle => {

    handle.addEventListener("mousedown", e => {
    
      if (windowEl.classList.contains("window-fullscreen")) {
        return;
    }

      e.preventDefault();
      e.stopPropagation();

      resizing = true;
      direction = handle.dataset.direction;

      startX = e.clientX;
      startY = e.clientY;

      const rect = windowEl.getBoundingClientRect();

      startWidth = rect.width;
      startHeight = rect.height;

      startLeft = rect.left;
      startTop = rect.top;

      document.body.style.userSelect = "none";
    });

  });

  document.addEventListener("mousemove", e => {

    if (!resizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;

    let newLeft = startLeft;
    let newTop = startTop;

    /* --------------------------------
       RIGHT
    -------------------------------- */

    if (
      direction === "right" ||
      direction === "top-right" ||
      direction === "bottom-right"
    ) {
      newWidth = startWidth + dx;
    }

    /* --------------------------------
       LEFT
    -------------------------------- */

    if (
      direction === "left" ||
      direction === "top-left" ||
      direction === "bottom-left"
    ) {
      newWidth = startWidth - dx;
      newLeft = startLeft + dx;
    }

    /* --------------------------------
       BOTTOM
    -------------------------------- */

    if (
      direction === "bottom" ||
      direction === "bottom-left" ||
      direction === "bottom-right"
    ) {
      newHeight = startHeight + dy;
    }

    /* --------------------------------
       TOP
    -------------------------------- */

    if (
      direction === "top" ||
      direction === "top-left" ||
      direction === "top-right"
    ) {
      newHeight = startHeight - dy;
      newTop = startTop + dy;
    }

    /* --------------------------------
       MINIMUM SIZE
    -------------------------------- */

    if (newWidth < minWidth) {

      if (
        direction === "left" ||
        direction === "top-left" ||
        direction === "bottom-left"
      ) {
        newLeft = startLeft + (startWidth - minWidth);
      }

      newWidth = minWidth;
    }

    if (newHeight < minHeight) {

      if (
        direction === "top" ||
        direction === "top-left" ||
        direction === "top-right"
      ) {
        newTop = startTop + (startHeight - minHeight);
      }

      newHeight = minHeight;
    }

    /* --------------------------------
       KEEP WINDOW INSIDE VIEWPORT
    -------------------------------- */

    const maxWidth = window.innerWidth - newLeft - 10;
    const maxHeight = window.innerHeight - newTop - 10;

    newWidth = Math.min(newWidth, maxWidth);
    newHeight = Math.min(newHeight, maxHeight);

    /* --------------------------------
       APPLY
    -------------------------------- */

    windowEl.style.width = `${newWidth}px`;
    windowEl.style.height = `${newHeight}px`;

    windowEl.style.left = `${newLeft}px`;
    windowEl.style.top = `${newTop}px`;

  });

  document.addEventListener("mouseup", () => {

    if (!resizing) return;

    resizing = false;
    direction = "";

    document.body.style.userSelect = "";

  });

});

/////////////////////////// FULLSCREEN BUTTONS ///////////////////////////

function toggleFullscreenWindow(button) {
    if (!button) return;

    var windowElement = button.closest(".window");

    if (!windowElement) return;

    /* --------------------------------
   ENTER FULLSCREEN
-------------------------------- */

if (!windowElement.classList.contains("window-fullscreen")) {

    // Save current position and size
    windowElement.dataset.oldWidth =
        windowElement.offsetWidth + "px";

    windowElement.dataset.oldHeight =
        windowElement.offsetHeight + "px";

    windowElement.dataset.oldLeft =
        windowElement.offsetLeft + "px";

    windowElement.dataset.oldTop =
        windowElement.offsetTop + "px";


    // Enter fullscreen
    windowElement.classList.add("window-fullscreen");


    // Bring fullscreen window ABOVE top bar
    biggestIndex++;

    windowElement.style.zIndex = biggestIndex + 2;

    if (topBar) {
        topBar.style.zIndex = biggestIndex + 1;
    }


    // Change button icon
    button.textContent = "❐";
}

    /* --------------------------------
       EXIT FULLSCREEN
    -------------------------------- */

    else {

        windowElement.classList.remove("window-fullscreen");

        // Restore previous size
        windowElement.style.width =
            windowElement.dataset.oldWidth;

        windowElement.style.height =
            windowElement.dataset.oldHeight;

        // Restore previous position
        windowElement.style.left =
            windowElement.dataset.oldLeft;

        windowElement.style.top =
            windowElement.dataset.oldTop;

        button.textContent = "□";
    }
}


var fullscreenButtons =
    document.querySelectorAll(".fullscreenwindow");

fullscreenButtons.forEach(function (button) {

    button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        toggleFullscreenWindow(button);
    });

});