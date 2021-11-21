const {Clutter, Gdk, GLib, GObject, St} = imports.gi;
const Cairo = imports.cairo;
const Dash = imports.ui.dash;
const Main = imports.ui.main;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const schema = Me.imports.schema;

const faceWidth = 0.1;
const armWidthHour = 0.1;
const armWidthMinutes = 0.1;
const armWidthSeconds = 0.05;
const radius = 0.5;
const innerRadius = radius - faceWidth;
const hLength = innerRadius * 0.5;
const mLength = innerRadius * 0.9;
const sLength = innerRadius * 0.9;
const NO_TIMEOUT = 0;

// eslint-disable-next-line function-paren-newline
this.AnalogClock = GObject.registerClass(
class AnalogClock extends St.BoxLayout {
    _init(shouldShow, wallClock) {
        super._init({
            style_class: 'analog-clock',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.label = new St.Label({style_class: 'dash-label'});
        this.label.hide();
        this.label_actor = this.label;

        this._analogClock = new St.DrawingArea({
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
        });
        this._analogClock.connect(
            'repaint',
            this._paintClock.bind(this._analogClock)
        );
        this.add_child(this._analogClock);
        this._updateClock();

        this._wallClock = wallClock;
        this._clockHandler = this._wallClock.connect(
            'notify::clock',
            this._updateClock.bind(this)
        );

        this._shouldShow = shouldShow;
        this._resetHoverTimeoutId = NO_TIMEOUT;
        this._showLabelTimeoutId = NO_TIMEOUT;
        this._labelShowing = false;

        this._configureSettings();
        this.connect('destroy', this._onDestroy.bind(this));
    }

    _setExtraSize(extraSize) {
        this._extraSize = extraSize;
        const minSize = 1;
        const maxSize = Main.panel.height;
        const size = Math.min(
            Math.max(Panel.PANEL_ICON_SIZE + extraSize, minSize),
            maxSize
        );
        this.set_width(size);
        this.set_height(size);
    }

    _configureSettings() {
        const settings = ExtensionUtils.getSettings(schema.SCHEMA_NAME);
        const settingsDesktop = ExtensionUtils.getSettings('org.gnome.desktop.interface');
        settings.connect(`changed::${schema.KEYS.EXTRA_SIZE}`, () => {
            this._setExtraSize(settings.get_int(schema.KEYS.EXTRA_SIZE));
        });
        settings.connect(`changed::${schema.KEYS.SWEEPING_MOTION}`, () => {
            this._analogClock._sweepingMotion
                = settings.get_boolean(schema.KEYS.SWEEPING_MOTION);
            this._analogClock.queue_repaint();
        });
        settingsDesktop.connect('changed::clock-show-seconds', () => {
            this._analogClock._showSeconds
                = settingsDesktop.get_boolean('clock-show-seconds');
            this._analogClock.queue_repaint();
        });
        settings.connect(`changed::${schema.KEYS.USE_THEME}`, () => {
            this._analogClock._useThemeColor
                = settings.get_boolean(schema.KEYS.USE_THEME);
            this._analogClock.queue_repaint();
        });
        settings.connect(`changed::${schema.KEYS.FACE_COLOR}`, () => {
            this._analogClock._faceColor
                = this._getColorSetting(schema.KEYS.FACE_COLOR);
            this._analogClock.queue_repaint();
        });
        settings.connect(`changed::${schema.KEYS.HOUR_COLOR}`, () => {
            this._analogClock._hourColor
                = this._getColorSetting(schema.KEYS.HOUR_COLOR);
            this._analogClock.queue_repaint();
        });
        settings.connect(`changed::${schema.KEYS.MINUTE_COLOR}`, () => {
            this._analogClock._minuteColor
                = this._getColorSetting(schema.KEYS.MINUTE_COLOR);
            this._analogClock.queue_repaint();
        });
        settings.connect(`changed::${schema.KEYS.SECOND_COLOR}`, () => {
            this._analogClock._secondColor
                = this._getColorSetting(schema.KEYS.SECOND_COLOR);
            this._analogClock.queue_repaint();
        });

        this._settings = settings;
        this._settingsDesktop = settingsDesktop;
        this._setExtraSize(settings.get_int(schema.KEYS.EXTRA_SIZE));
        this._analogClock._useThemeColor
            = settings.get_boolean(schema.KEYS.USE_THEME);
        this._analogClock._faceColor
            = this._getColorSetting(schema.KEYS.FACE_COLOR);
        this._analogClock._hourColor
            = this._getColorSetting(schema.KEYS.HOUR_COLOR);
        this._analogClock._minuteColor
            = this._getColorSetting(schema.KEYS.MINUTE_COLOR);
        this._analogClock._secondColor
            = this._getColorSetting(schema.KEYS.SECOND_COLOR);
        this._analogClock._showSeconds
            = settingsDesktop.get_boolean('clock-show-seconds');
        this._analogClock._sweepingMotion
            = settings.get_boolean(schema.KEYS.SWEEPING_MOTION);
    }

    _getColorSetting(key) {
        const colorHex = this._settings.get_string(key);
        const color = new Gdk.RGBA();
        color.parse(colorHex);
        return color;
    }

    hoverChanged() {
        if (this._shouldShow()) {
            if (this._showLabelTimeoutId === NO_TIMEOUT) {
                const timeout
                    = this._labelShowing ? 0 : Dash.DASH_ITEM_HOVER_TIMEOUT;
                this._showLabelTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    timeout,
                    () => {
                        this._labelShowing = true;
                        this._showLabel();
                        this._showLabelTimeoutId = NO_TIMEOUT;
                        return GLib.SOURCE_REMOVE;
                    }
                );
                if (this._resetHoverTimeoutId !== NO_TIMEOUT) {
                    GLib.source_remove(this._resetHoverTimeoutId);
                    this._resetHoverTimeoutId = NO_TIMEOUT;
                }
            }
        } else {
            if (this._showLabelTimeoutId !== NO_TIMEOUT) {
                GLib.source_remove(this._showLabelTimeoutId);
            }

            this._showLabelTimeoutId = NO_TIMEOUT;
            this._hideLabel();

            if (this._labelShowing) {
                this._resetHoverTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    Dash.DASH_ITEM_HOVER_TIMEOUT,
                    () => {
                        this._labelShowing = false;
                        this._resetHoverTimeoutId = NO_TIMEOUT;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            }
        }
    }

    _hideLabel() {
        this.label.ease({
            duration: Dash.DASH_ITEM_LABEL_HIDE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.label.hide(),
            opacity: 0,
        });
    }

    _showLabel() {
        this._labelText = this._wallClock.clock;
        this.label.set_text(this._labelText);
        this.label.opacity = 0;
        this.label.show();

        const stageX = this.get_transformed_position()[0];
        const stageY = 0;
        const itemHeight = Main.panel.height;
        const itemWidth = this.get_width();
        const labelWidth = this.label.get_width();

        const yOffset = Math.floor(itemHeight + 5);
        const yPosition = stageY + yOffset;
        const xOffset = Math.floor((itemWidth - labelWidth) / 2);
        let xPosition = stageX + xOffset;
        if (global.screen_width < xPosition + labelWidth) {
            xPosition = global.screen_width - labelWidth - 4;
        }

        this.label.set_position(xPosition, yPosition);
        this.label.ease({
            duration: Dash.DASH_ITEM_LABEL_SHOW_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            opacity: 255,
        });
    }


    _updateClock() {
        this._analogClock.queue_repaint();
        if (this.label.visible) {
            this._labelText = this._wallClock.clock;
            this.label.set_text(this._labelText);
        }
    }

    _paintClock(area) {
        const cr = area.get_context();
        const areaHeight = area.get_height();
        if (areaHeight === 0) {
            return;
        }

        const themeNode = area.get_theme_node();
        const themeColor = themeNode.get_foreground_color();

        const date = new Date();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        let hRotation;
        let mRotation;
        let sRotation;
        if (this._sweepingMotion) {
            hRotation = ((hours + (minutes / 60.0) + (seconds / 3600.0))
                / 12.0 * 2 * Math.PI) + Math.PI;
            mRotation = ((minutes + (seconds / 60.0))
                / 60.0 * 2 * Math.PI) + Math.PI;
            sRotation = (seconds / 60.0 * 2 * Math.PI) + Math.PI;
        } else {
            hRotation = (hours / 12.0 * 2 * Math.PI) + Math.PI;
            mRotation = (minutes / 60.0 * 2 * Math.PI) + Math.PI;
            sRotation = (seconds / 60.0 * 2 * Math.PI) + Math.PI;
        }

        cr.save();
        cr.setSourceRGBA(
            themeColor.red / 0xFF,
            themeColor.green / 0xFF,
            themeColor.blue / 0xFF,
            themeColor.alpha / 0xFF
        );

        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.scale(areaHeight, areaHeight);
        cr.translate(radius, radius);

        // Draw face
        cr.save();
        if (!this._useThemeColor) {
            const color = this._faceColor;
            cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
        }
        cr.setLineWidth(faceWidth);
        cr.arc(0, 0, radius - (faceWidth / 2.0), 0, 2 * Math.PI);
        cr.stroke();
        cr.restore();

        // Draw hours arm
        cr.save();
        if (!this._useThemeColor) {
            const color = this._hourColor;
            cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
        }
        cr.setLineWidth(armWidthHour);
        cr.rotate(hRotation);
        cr.moveTo(0, 0);
        cr.lineTo(0, hLength);
        cr.stroke();
        cr.restore();

        // Draw minutes arm
        cr.save();
        if (!this._useThemeColor) {
            const color = this._minuteColor;
            cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
        }
        cr.setLineWidth(armWidthMinutes);
        cr.rotate(mRotation);
        cr.moveTo(0, 0);
        cr.lineTo(0, mLength);
        cr.stroke();
        cr.restore();

        // Draw seconds arm
        if (this._showSeconds) {
            cr.save();
            if (!this._useThemeColor) {
                const color = this._secondColor;
                cr.setSourceRGBA(
                    color.red,
                    color.green,
                    color.blue,
                    color.alpha
                );
            }
            cr.setLineWidth(armWidthSeconds);
            cr.rotate(sRotation);
            cr.moveTo(0, 0);
            cr.lineTo(0, sLength);
            cr.stroke();
            cr.restore();
        }
        cr.restore();
        cr.$dispose();
    }

    _onDestroy() {
        this._settings.run_dispose();
        this._settingsDesktop.run_dispose();
        this._hideLabel();
        if (this._resetHoverTimeoutId !== NO_TIMEOUT) {
            GLib.source_remove(this._resetHoverTimeoutId);
        }
        if (this._showLabelTimeoutId !== NO_TIMEOUT) {
            GLib.source_remove(this._showLabelTimeoutId);
        }
        this._wallClock.disconnect(this._clockHandler);
        this.label.destroy();
    }
});
