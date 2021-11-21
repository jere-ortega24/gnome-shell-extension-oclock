const {Gio, Gtk, Gdk} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const schema = Me.imports.schema;

let settings;

const onColorChange = (picker, key) => {
    const rgba = picker.get_rgba();
    const red = Math.round(rgba.red * 0xFF).toString(16).padStart(2, '0');
    const green = Math.round(rgba.green * 0xFF).toString(16).padStart(2, '0');
    const blue = Math.round(rgba.blue * 0xFF).toString(16).padStart(2, '0');
    let alpha = '';
    if (rgba.alpha !== 1) {
        alpha = Math.round(rgba.alpha * 0xFF).toString(16).padStart(2, '0');
    }
    const colorHex = `#${red}${green}${blue}${alpha}`;
    settings.set_string(key, colorHex);
};

const setPickerColor = (picker, key) => {
    const color = settings.get_string(key);
    const rgba = new Gdk.RGBA();
    rgba.parse(color);
    picker.set_rgba(rgba);
};

// eslint-disable-next-line no-empty-function
this.init = () => {};

this.buildPrefsWidget = () => {
    const builder = new Gtk.Builder();
    settings = ExtensionUtils.getSettings(schema.SCHEMA_NAME);
    builder.add_from_file(`${Me.path}/prefs.ui`);

    const options = [
        {
            property: 'active-id',
            schemaKey: schema.KEYS.CLOCK_POSITION,
            uiId: 'clock-position-combobox',
        },
        {
            property: 'value',
            schemaKey: schema.KEYS.EXTRA_SIZE,
            uiId: 'extra-size-spin',
        },
        {
            property: 'active',
            schemaKey: schema.KEYS.USE_THEME,
            uiId: 'use-theme-color-switch',
        },
        {
            property: 'active',
            schemaKey: schema.KEYS.SHOW_LABEL,
            uiId: 'show-label-switch',
        },
        {
            property: 'active',
            schemaKey: schema.KEYS.SWEEPING_MOTION,
            uiId: 'sweeping-motion-switch',
        },
    ];

    for (const option of options) {
        settings.bind(
            option.schemaKey,
            builder.get_object(option.uiId),
            option.property,
            Gio.SettingsBindFlags.DEFAULT
        );
    }

    const colorPickerOptions = [
        {
            schemaKey: schema.KEYS.FACE_COLOR,
            uiId: 'face-color-picker',
        },
        {
            schemaKey: schema.KEYS.HOUR_COLOR,
            uiId: 'hour-color-picker',
        },
        {
            schemaKey: schema.KEYS.MINUTE_COLOR,
            uiId: 'minute-color-picker',
        },
        {
            schemaKey: schema.KEYS.SECOND_COLOR,
            uiId: 'second-color-picker',
        },
    ];

    for (const pickerOptions of colorPickerOptions) {
        const colorPicker = builder.get_object(pickerOptions.uiId);
        colorPicker.connect(
            'color-set',
            () => {
                onColorChange(colorPicker, pickerOptions.schemaKey);
            }
        );
        settings.connect(
            `changed::${pickerOptions.schemaKey}`,
            () => {
                setPickerColor(colorPicker, pickerOptions.schemaKey);
            }
        );
        setPickerColor(colorPicker, pickerOptions.schemaKey);
    }

    builder.get_object('version-label').set_label(Me.metadata.version.toString());
    builder.get_object('maintainer-label').set_label(Me.metadata.author.toString());
    builder.get_object('website-label').set_uri(Me.metadata.url.toString());

    return builder.get_object('main');
};
