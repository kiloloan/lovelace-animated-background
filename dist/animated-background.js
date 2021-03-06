//const
const debug_prefix = "Animated Background DEBUG: ";
const log_prefix = "Animated Background: "

//globals
var root;
var panel_resolver;
var hui;
var lovelace;
var animatedConfig;
var viewLayout;
var haobj = null;
var view;
var debug_mode = false;
var loaded = false;
var view_loaded = false;

//state tracking variables
let previous_state;
let previous_entity;
let previous_url;


function STATUS_MESSAGE(message, force) {
  if (!debug_mode) {
    console.log(log_prefix + message);
  }
  else {
    if (force) {
      console.log(debug_prefix + message);
    }
  }
}

function DEBUG_MESSAGE(message, object, only_if_view_not_loaded) {
  if (debug_mode) {
    if (only_if_view_not_loaded && view_loaded) {
      return;
    }
    console.log(debug_prefix + message);
    if (!isNullOrUndefined(object)) {
      console.log(object);
    }
  }
}

//reset all DOM variables
function get_vars() {
  root = document.querySelector("home-assistant");
  root = root && root.shadowRoot;
  root = root && root.querySelector("home-assistant-main");
  root = root && root.shadowRoot;
  root = root && root.querySelector("app-drawer-layout partial-panel-resolver");
  panel_resolver = root;
  root = (root && root.shadowRoot) || root;
  root = root && root.querySelector("ha-panel-lovelace");
  root = root && root.shadowRoot;
  root = root && root.querySelector("hui-root");
  hui = root;
  if (!isNullOrUndefined(root)) {
    lovelace = root.lovelace;
    if (!isNullOrUndefined(lovelace)) {
      animatedConfig = lovelace.config.animated_background;
    }
    viewLayout = root.shadowRoot.getElementById("layout");
    view = root.shadowRoot.getElementById("view");
  }
}

//Mutation observer to set the background of views to transparent each time a new tab is selected
var viewObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes.length > 0) {
      view_loaded = false;
      if (currentViewEnabled()) {
        renderBackgroundHTML();
        removeDefaultBackground();
      }
    }
  });
});

//Mutation observer to refresh video on HA refresh
var huiObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes.length > 0) {
      renderBackgroundHTML();
    }
  });
});

//Mutation observer to reload on dashboard change
var panelObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    if (mutation.addedNodes.length > 0) {
      if (mutation.addedNodes[0].nodeName.toLowerCase() == "ha-panel-lovelace") {
        var wait = 0;
        var wait_interval = setInterval(() => {
          get_vars()
          if (!isNullOrUndefined(hui)) {
            previous_entity = null;
            previous_state = null;
            previous_url = null;
            loaded = false;
            run();
            clearInterval(wait_interval);
          }
        }, 1000 / 60);
      }

    }
  });
});

//main function
function run() {
  get_vars();

  STATUS_MESSAGE("Starting", true);
  //subscribe to hass object to detect state changes
  if (isNullOrUndefined(haobj)) {
    document.querySelector("home-assistant").provideHass({
      set hass(value) {
        haobj = value;
        renderBackgroundHTML();
      }
    });
  }

  viewObserver.disconnect();
  viewObserver.observe(view, {
    characterData: true,
    childList: true,
    subtree: true,
    characterDataOldValue: true
  });

  huiObserver.disconnect();
  huiObserver.observe(hui, {
    characterData: true,
    childList: true,
    subtree: true,
    characterDataOldValue: true
  });

  panelObserver.disconnect();
  panelObserver.observe(panel_resolver, {
    characterData: true,
    childList: true,
    subtree: true,
    characterDataOldValue: true
  });

  if (!isNullOrUndefined(animatedConfig)) {
    if (enabled()) {
      renderBackgroundHTML();
    }
    else {
      STATUS_MESSAGE("Current environment is not enabled in Lovelace configuration");
      DEBUG_MESSAGE("Not loaded, this is the currently found configuration", currentConfig());
    }
  }
  else {
    STATUS_MESSAGE("No configuration found", true);
  }
}

//return the currently selected lovelace view
function currentViewPath() {
  return window.location.pathname.split('/')[2];
}

//bool returns whether current configuration exists in animated_config (different from enabled in that no haobj is required and is more flexible)

//generic null/undefined/empty helper function
function isNullOrUndefined(obj) {
  if (obj == null) {
    return true;
  }
  if (obj == undefined) {
    return true;
  }
  if (obj == "") {
    return true;
  }
  return false;
}

//logic for checking if enabled in configuration
function enabled() {
  var temp_configured = false;
  if (!isNullOrUndefined(animatedConfig)) {
    if (!isNullOrUndefined(animatedConfig.default_url) || !isNullOrUndefined(animatedConfig.entity) || !isNullOrUndefined(animatedConfig.views) || !isNullOrUndefined(animatedConfig.groups)) {
      temp_configured = true;
    }

    if (!isNullOrUndefined(animatedConfig.debug)) {
      if (!loaded) {
        debug_mode = animatedConfig.debug;
        DEBUG_MESSAGE("Debug mode enabled");

        if (!isNullOrUndefined(animatedConfig.display_user_agent)) {
          if (animatedConfig.display_user_agent == true) {
            alert(navigator.userAgent);
          }
        }
      }

    }
    else {
      debug_mode = false;
    }
  }
  else {
    return false;
  }

  if (temp_configured == false) {
    return false;
  }

  var current_config = currentConfig();

  if (isNullOrUndefined(haobj)) {
    return false;
  }

  var temp_enabled = true;

  if (isNullOrUndefined(current_config)) {
    return false;
  }

  if (!isNullOrUndefined(animatedConfig.excluded_devices)) {
    if (animatedConfig.excluded_devices.some(device_included)) {
      DEBUG_MESSAGE("Current device is excluded", null, true);
      temp_enabled = false;
    }
  }
  if (!isNullOrUndefined(current_config.excluded_devices)) {
    if (current_config.excluded_devices.some(device_included)) {
      DEBUG_MESSAGE("Current device is excluded", null, true);
      temp_enabled = false;
    }
  }

  if (!isNullOrUndefined(animatedConfig.excluded_users)) {
    if (animatedConfig.excluded_users.map(username => username.toLowerCase()).includes(haobj.user.name.toLowerCase())) {
      DEBUG_MESSAGE("Current user: " + haobj.user.name + " is excluded", null, true);
      temp_enabled = false;
    }
  }
  if (!isNullOrUndefined(current_config.excluded_users)) {
    if (current_config.excluded_users.map(username => username.toLowerCase()).includes(haobj.user.name.toLowerCase())) {
      DEBUG_MESSAGE("Current user: " + haobj.user.name + " is excluded", null, true);
      temp_enabled = false;
    }
  }

  if (!isNullOrUndefined(animatedConfig.included_users)) {
    if (animatedConfig.included_users.map(username => username.toLowerCase()).includes(haobj.user.name.toLowerCase())) {
      temp_enabled = true;
    }
    else {
      DEBUG_MESSAGE("Current user: " + haobj.user.name + " is not included", null, true);
      temp_enabled = false;
    }
  }
  if (!isNullOrUndefined(current_config.included_users)) {
    if (current_config.included_users.map(username => username.toLowerCase()).includes(haobj.user.name.toLowerCase())) {
      temp_enabled = true;
    }
    else {
      DEBUG_MESSAGE("Current user: " + haobj.user.name + " is not included", null, true);
      temp_enabled = false;
    }
  }

  if (!isNullOrUndefined(animatedConfig.included_devices)) {
    if (animatedConfig.included_devices.some(device_included)) {
      temp_enabled = true;
    }
    else {
      DEBUG_MESSAGE("Current device is not included", null, true);
      temp_enabled = false;
    }
  }

  if (!isNullOrUndefined(current_config.included_devices)) {
    if (current_config.included_devices.some(device_included)) {
      temp_enabled = true;
    }
    else {
      DEBUG_MESSAGE("Current device is not included", null, true);
      temp_enabled = false;
    }
  }

  if (!isNullOrUndefined(current_config.enabled)) {
    if (current_config.enabled == false) {
      DEBUG_MESSAGE("Current config is disabled", null, true);
      temp_enabled = false;
    }
    else {
      temp_enabled = true;
    }
  }

  loaded = true;
  view_loaded = true;

  return temp_enabled;
}

//Current known support: iphone, ipad (if set to mobile site option), windows, macintosh, android
function device_included(element, index, array) {
  return navigator.userAgent.toLowerCase().includes(element.toLowerCase());
}

//remove background every 100 milliseconds for 2 seconds because race condition memes.
var meme_remover = null;
var meme_count = 0;
var meme_logged = false;
function removeDefaultBackground() {
  if (isNullOrUndefined(meme_remover)) {
    meme_logged = false;
    meme_remover = setInterval(() => {
      get_vars();
      var viewNode = null;
      var temp_enabled = enabled();
      if (!isNullOrUndefined(root)) {
        viewNode = root.shadowRoot.getElementById("view");
        viewNode = viewNode.querySelector('hui-view');
        if (!isNullOrUndefined(viewNode)) {
          if (temp_enabled) {
            viewNode.style.background = 'transparent';
            viewLayout.style.background = 'transparent';
            if (!meme_logged) {
              DEBUG_MESSAGE("Removing view background", currentConfig());
              meme_logged = true;
            }
          }
          else {
            viewLayout.style.background = null;
            viewNode.style.background = null;
          }
        }
        else {
          viewNode = root.shadowRoot.getElementById("view");
          viewNode = viewNode.querySelector("hui-panel-view");
          if (!isNullOrUndefined(viewNode)) {
            if (temp_enabled) {
              viewNode.style.background = 'transparent';
              viewLayout.style.background = 'transparent';
              if (!meme_logged) {
                DEBUG_MESSAGE("Panel mode detected");
                DEBUG_MESSAGE("Removing view background", currentConfig());
                meme_logged = true;
              }
            }
            else {
              viewLayout.style.background = null;
              viewNode.style.background = "var(--lovelace-background);";
            }
          }
        }
      }
      meme_count++;
      if (meme_count > 20) {
        clearInterval(meme_remover);
        meme_remover = null;
        meme_count = 0;
      }
    }, 100);
  }

}

function getGroupConfig(name) {
  var return_config = null;
  if(name == "none"){
    return {enabled: false };
  }
  if (!isNullOrUndefined(animatedConfig.groups)) {
    animatedConfig.groups.forEach(group => {
      if (!isNullOrUndefined(group.name)) {
        if (group.name == name) {
          if (!isNullOrUndefined(group.config)) {
            return_config = group.config;
          }
        }
      }
    })
  }
  return return_config;
}

//return the current view configuration or null if none is found
function currentConfig() {
  var current_view_path = currentViewPath();
  var return_config = null;
  if (!isNullOrUndefined(animatedConfig)) {
    if (!isNullOrUndefined(animatedConfig.entity) || !isNullOrUndefined(animatedConfig.default_url)) {
      return_config = animatedConfig;
    }

    if (!isNullOrUndefined(animatedConfig.views)) {
      animatedConfig.views.forEach(view => {
        if (view.path == current_view_path) {
          if (!isNullOrUndefined(view.config)) {
            return_config = view.config;
          }
          else {
            STATUS_MESSAGE("Error, defined view has no config", true);
          }
        }
      });
    }

    var current_view_path = currentViewPath();
    var current_view_config = lovelace.config.views[lovelace.current_view];
    if (!isNullOrUndefined(lovelace) && !isNullOrUndefined(current_view_path)) {
      for (var i = 0; lovelace.config.views.length > i; i++) {
        if (lovelace.config.views[i].path == current_view_path) {
          current_view_config = lovelace.config.views[i];
        }
        else {
          if (i.toString() == current_view_path.toString()) {
            current_view_config = lovelace.config.views[i];
          }
        }
      }

      if (!isNullOrUndefined(current_view_config)) {
        var potential_config = getGroupConfig(current_view_config.animated_background);
        if (!isNullOrUndefined(potential_config)) {
          return_config = potential_config;
        }
      }
    }
  }
  return return_config;
}

//bool whether currentConfig returns a non-null value
function currentViewEnabled() {
  var current_config = currentConfig();
  if (isNullOrUndefined(current_config)) {
    DEBUG_MESSAGE("View switched, no configuration found");
    return false;
  }
  else {
    if (current_config.enabled == false) {
      //DEBUG_MESSAGE("View switched, current view is disabled", current_config);
    }
  }
  return !isNullOrUndefined(current_config);
}

//main render function
function renderBackgroundHTML() {
  if (!enabled()) {
    return;
  }

  var stateURL = "";
  var selectedConfig = currentConfig();

  //rerender background if entity has changed (to avoid no background refresh if the new entity happens to have the same state)
  if (previous_entity != selectedConfig.entity) {
    previous_state = null;
  }

  //get state of config object 
  if (!isNullOrUndefined(selectedConfig.entity)) {
    var current_state = haobj.states[selectedConfig.entity].state;
    if (previous_state != current_state) {
      STATUS_MESSAGE("Configured entity " + selectedConfig.entity + " is now " + current_state, true);
      if (selectedConfig.state_url[current_state]) {
        stateURL = selectedConfig.state_url[current_state];
      }
      else {
        if (selectedConfig.default_url) {
          stateURL = selectedConfig.default_url;
        }
      }
      previous_state = current_state;
      previous_entity = selectedConfig.entity;
    }
  }
  else {
    if (selectedConfig.default_url) {
      stateURL = selectedConfig.default_url;
    }
  }

  var htmlToRender;
  if (stateURL != "") {
    var bg = hui.shadowRoot.getElementById("background-video");
    if (isNullOrUndefined(bg)) {
      if (!selectedConfig.entity) {
        STATUS_MESSAGE("Applying default background", true);
      }
      htmlToRender = `<style>
      .bg-video{
          min-width: 100vw; 
          min-height: 100vh;
          
      }
      .bg-wrap{
          position: fixed;
          right: 0;
          top: 0;
          min-width: 100vw; 
          min-height: 100vh;
          z-index: -10;
      }    
    </style>
    <div id="background-video" class="bg-wrap">
     <iframe class="bg-video" frameborder="0" src="${stateURL}"/> 
    </div>`;
      viewLayout.insertAdjacentHTML("beforebegin", htmlToRender);
      previous_url = stateURL;
      removeDefaultBackground();
    }
    else {
      htmlToRender = `<iframe class="bg-video" frameborder="0" src="${stateURL}"/>`;
      if (selectedConfig.entity || (previous_url != stateURL)) {
        removeDefaultBackground();
        if (!selectedConfig.entity) {
          STATUS_MESSAGE("Applying default background", true);
        }
        bg.innerHTML = htmlToRender;
        previous_url = stateURL;
      }
    }
  }
}

run();
