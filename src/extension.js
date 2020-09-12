const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const schema = Me.imports.schema;
const {AnalogClock} = Me.imports.analogClock;

let originalClock;
let analogClock;
let settings;
let dateMenu;
const NO_HANDLER = 0;
let hoverHandler = NO_HANDLER;
let clickHandler = NO_HANDLER;

const connectLabelHandlers = () => {
    if (hoverHandler === NO_HANDLER) {
        hoverHandler = dateMenu.connect(
            'notify::hover',
            analogClock.hoverChanged.bind(analogClock)
        );
    }
    if (clickHandler === NO_HANDLER) {
        clickHandler = dateMenu.menu.connect(
            'open-state-changed',
            analogClock.hoverChanged.bind(analogClock)
        );
    }
};

const disconnectLabelHandlers = () => {
    if (hoverHandler !== NO_HANDLER) {
        dateMenu.disconnect(hoverHandler);
        hoverHandler = NO_HANDLER;
    }
    if (clickHandler !== NO_HANDLER) {
        dateMenu.menu.disconnect(clickHandler);
        clickHandler = NO_HANDLER;
    }
};

this.enable = () => {
    dateMenu = Main.panel.statusArea.dateMenu;
    const layout = dateMenu.get_child_at_index(0);

    function shouldShow() {
        return dateMenu.hover && !dateMenu.menu.isOpen;
    }

    const wallClock = dateMenu._clock;
    analogClock = new AnalogClock(shouldShow, wallClock);
    originalClock = dateMenu._clockDisplay;

    settings = ExtensionUtils.getSettings(schema.SCHEMA_NAME);
    let clockPosition = settings.get_enum(schema.KEYS.CLOCK_POSITION);
    settings.connect(
        `changed::${schema.KEYS.SHOW_LABEL}`,
        () => {
            const showLabel = settings.get_boolean(schema.KEYS.SHOW_LABEL);
            if (showLabel) {
                connectLabelHandlers();
            } else {
                disconnectLabelHandlers();
            }
        }
    );
    settings.connect(
        `changed::${schema.KEYS.CLOCK_POSITION}`,
        () => {
            const newClockPosition
                = settings.get_enum(schema.KEYS.CLOCK_POSITION);
            if (newClockPosition === schema.CLOCK_POSITIONS.IN_PLACE) {
                layout.remove_child(originalClock);
            } else if (clockPosition === schema.CLOCK_POSITIONS.IN_PLACE) {
                if (newClockPosition === schema.CLOCK_POSITIONS.AFTER) {
                    layout.insert_child_below(originalClock, analogClock);
                } else {
                    layout.insert_child_above(originalClock, analogClock);
                }
            } else {
                const index = layout.get_children().indexOf(originalClock);
                layout.set_child_at_index(analogClock, index);
            }
            clockPosition = newClockPosition;
        }
    );

    switch (clockPosition) {
    case schema.CLOCK_POSITIONS.BEFORE:
        layout.insert_child_below(analogClock, originalClock);
        break;
    case schema.CLOCK_POSITIONS.IN_PLACE:
        layout.replace_child(originalClock, analogClock);
        break;
    case schema.CLOCK_POSITIONS.AFTER:
    default:
        layout.insert_child_above(analogClock, originalClock);
        break;
    }

    Main.layoutManager.addChrome(analogClock.label);
    const showLabel = settings.get_boolean(schema.KEYS.SHOW_LABEL);
    if (showLabel) {
        connectLabelHandlers();
    }

    dateMenu._analogClock = analogClock;
};

this.disable = () => {
    disconnectLabelHandlers();
    const layout = dateMenu.get_child_at_index(0);
    const clockPosition = settings.get_enum(schema.KEYS.CLOCK_POSITION);
    if (clockPosition === schema.CLOCK_POSITIONS.IN_PLACE) {
        layout.replace_child(analogClock, originalClock);
    } else {
        layout.remove_child(analogClock);
    }

    settings.run_dispose();
    settings = null;
    delete dateMenu._analogClock;
    analogClock.destroy();
    analogClock = null;
    originalClock = null;
    dateMenu = null;
};
