#include QMK_KEYBOARD_H
#include "telemetry.h"

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
    /*
     * Layer 0: Base QWERTY
     * Corne-inspired default layer with number row.
     */
    [0] = LAYOUT(
        KC_ESC,   KC_1,    KC_2,    KC_3,    KC_4,    KC_5,                          KC_6,    KC_7,    KC_8,    KC_9,    KC_0,    KC_BSPC,
        KC_TAB,   KC_Q,    KC_W,    KC_E,    KC_R,    KC_T,    KC_UP,      KC_DOWN,  KC_Y,    KC_U,    KC_I,    KC_O,    KC_P,    KC_LBRC,
        KC_CAPS,  KC_A,    KC_S,    KC_D,    KC_F,    KC_G,    KC_LEFT,    KC_RGHT,  KC_H,    KC_J,    KC_K,    KC_L,    KC_SCLN, KC_QUOT,
        KC_LSFT,  KC_Z,    KC_X,    KC_C,    KC_V,    KC_B,    KC_MUTE,    RGB_MOD,  KC_N,    KC_M,    KC_COMM, KC_DOT,  KC_SLSH, KC_ENT,
                                      KC_LALT, MO(1),  KC_SPC,                       KC_ENT,  MO(2),   KC_RCTL
    ),

    /*
     * Layer 1: Symbols / navigation / function keys
     */
    [1] = LAYOUT(
        KC_GRV,   KC_F1,   KC_F2,   KC_F3,   KC_F4,   KC_F5,                        KC_F6,   KC_F7,   KC_F8,   KC_F9,   KC_F10,  KC_DEL,
        _______,  KC_EXLM, KC_AT,   KC_HASH, KC_DLR,  KC_PERC, KC_PGUP,    KC_HOME,  KC_CIRC, KC_AMPR, KC_ASTR, KC_LPRN, KC_RPRN, KC_RBRC,
        _______,  KC_LCTL, KC_LGUI, KC_LALT, KC_PIPE, KC_BSLS, KC_PGDN,    KC_END,   KC_LEFT, KC_DOWN, KC_UP,   KC_RGHT, KC_MINS, KC_EQL,
        _______,  _______, _______, _______, _______, _______, KC_MUTE,    RGB_TOG,  KC_UNDS, KC_PLUS, KC_LCBR, KC_RCBR, KC_COLN, KC_DQUO,
                                      _______, _______, _______,                     _______, MO(3),   _______
    ),

    /*
     * Layer 2: Numpad / F11-F12 / extra navigation
     */
    [2] = LAYOUT(
        KC_ESC,   KC_F11,  KC_F12,  _______, _______, _______,                      KC_NUM, _______, _______, _______,   _______, _______,
        _______,  _______, _______, _______, _______, _______, _______,    _______,  KC_PPLS, KC_P7,   KC_P8,   KC_P9,   KC_PAST, _______,
        _______,  _______, _______, _______, _______, _______, _______,    _______,  KC_PMNS, KC_P4,   KC_P5,   KC_P6,   KC_PSLS, _______,
        _______,  _______, _______, _______, _______, _______, KC_MUTE,    _______,  _______, KC_P1,   KC_P2,   KC_P3,   KC_ENT,  _______,
                                      _______, MO(3),   _______,                    _______, KC_P0, _______
    ),

    /*
     * Layer 3: System / RGB / bootloader
     */
    [3] = LAYOUT(
        QK_BOOT,  _______, _______, _______, _______, _______,                      _______, _______, _______, _______, _______, QK_BOOT,
        _______,  RGB_TOG, RGB_MOD, RGB_HUI, RGB_SAI, RGB_VAI, _______,   _______,  _______, _______, _______, _______, _______, _______,
        _______,  RGB_RMOD,RGB_HUD, RGB_SAD, RGB_VAD, RGB_SPI, _______,   _______,  _______, _______, _______, _______, _______, _______,
        _______,  EE_CLR,  _______, _______, _______, _______, KC_MUTE,   RGB_MOD,  _______, _______, _______, _______, _______, QK_BOOT,
                                      _______, _______, _______,                    _______, _______, _______
    )
};

#if defined(ENCODER_MAP_ENABLE)
const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][2] = {
    [0] = { ENCODER_CCW_CW(KC_LEFT,  KC_RIGHT), ENCODER_CCW_CW(KC_VOLD, KC_VOLU) },
    [1] = { ENCODER_CCW_CW(KC_PGDN,  KC_PGUP),  ENCODER_CCW_CW(RGB_HUD, RGB_HUI) },
    [2] = { ENCODER_CCW_CW(KC_DOWN,  KC_UP),    ENCODER_CCW_CW(RGB_VAD, RGB_VAI) },
    [3] = { ENCODER_CCW_CW(RGB_RMOD, RGB_MOD),  ENCODER_CCW_CW(RGB_SPD, RGB_SPI) },
};
#endif

#ifdef RGB_MATRIX_ENABLE

#include <string.h>
#include "transactions.h"

typedef struct {
    uint8_t h;
    uint8_t s;
} layer_hs_t;

/*
 * Colour per layer. Index = layer number.
 *
 * Layer 0 is deliberately absent: the base layer keeps whatever effect the
 * user picked in Vial. Entries left at {0, 0} are skipped the same way, so
 * adding a layer here is the only edit needed to give it a colour.
 */
static const layer_hs_t layer_colors[] = {
    [1] = { 128, 255 },  // nav / edit    - cyan
    [2] = {  85, 255 },  // numpad / F    - green
    [3] = {   0, 255 },  // adjust / boot - red
    [4] = {  21, 255 },  // gaming        - orange
    [5] = { 191, 255 },  // mouse         - purple
};

/*
 * Layer-switch markers.
 *
 * Every key on the active layer that leads somewhere else is lit in the
 * colour of the layer it takes you to; white means "back to the base layer".
 *
 * The table is read from the live Vial keymap, so remapping in Vial moves the
 * markers with no reflash. Only the master can do that lookup - the slave half
 * forwards matrix hits and never resolves keycodes, so its own dynamic keymap
 * is whatever the factory default was - hence the table is computed on the
 * master and shipped across the split link.
 */
#define MAX_MARKS 12

typedef struct __attribute__((packed)) {
    uint8_t layer;
    uint8_t count;
    struct __attribute__((packed)) {
        uint8_t led;
        uint8_t target;
    } mark[MAX_MARKS];
} layer_marks_t;

static layer_marks_t marks = { .layer = 0xFF, .count = 0 };

// Destination layer of a layer-switching keycode, or -1 for anything else.
static int8_t switch_target(uint16_t keycode, uint8_t current) {
    uint8_t target;

    if (IS_QK_MOMENTARY(keycode) || IS_QK_TO(keycode) || IS_QK_ONE_SHOT_LAYER(keycode)) {
        target = keycode & 0x1F;
    } else if (IS_QK_TOGGLE_LAYER(keycode) || IS_QK_LAYER_TAP_TOGGLE(keycode)) {
        target = keycode & 0x1F;
        // Toggling off the layer you are standing on drops you back to base.
        if (target == current) {
            target = 0;
        }
    } else if (IS_QK_LAYER_TAP(keycode)) {
        target = (keycode >> 8) & 0x0F;
    } else {
        return -1;
    }

    return (int8_t)target;
}

static void rebuild_marks(uint8_t layer) {
    marks.layer = layer;
    marks.count = 0;

    for (uint8_t row = 0; row < MATRIX_ROWS; row++) {
        for (uint8_t col = 0; col < MATRIX_COLS; col++) {
            uint8_t led = g_led_config.matrix_co[row][col];
            if (led == NO_LED) {
                continue;
            }

            keypos_t pos    = { .row = row, .col = col };
            int8_t   target = switch_target(keymap_key_to_keycode(layer, pos), layer);
            if (target < 0) {
                continue;
            }

            marks.mark[marks.count].led    = led;
            marks.mark[marks.count].target = (uint8_t)target;
            if (++marks.count >= MAX_MARKS) {
                return;
            }
        }
    }
}

static void layer_marks_slave_handler(uint8_t in_size, const void *in, uint8_t out_size, void *out) {
    if (in_size == sizeof(marks)) {
        memcpy(&marks, in, sizeof(marks));
    }
}

void keyboard_post_init_user(void) {
    transaction_register_rpc(LAYER_MARKS_SYNC, layer_marks_slave_handler);
}

void housekeeping_task_user(void) {
    trainer_task();
    if (!is_keyboard_master()) {
        return;
    }

    static uint32_t last_scan = 0;
    uint8_t         layer     = get_highest_layer(layer_state);

    // Rescan on every layer change, and once a second so a remap done in Vial
    // shows up without reflashing.
    if (layer != marks.layer || timer_elapsed32(last_scan) > 1000) {
        rebuild_marks(layer);
        last_scan = timer_read32();
        transaction_rpc_send(LAYER_MARKS_SYNC, sizeof(marks), &marks);
    }
}

bool rgb_matrix_indicators_advanced_user(uint8_t led_min, uint8_t led_max) {
    if (!rgb_matrix_is_enabled()) {
        return false;
    }

    uint8_t layer = get_highest_layer(layer_state);
    uint8_t val   = rgb_matrix_get_val();

    // Wash the board in the layer's colour. Layer 0 is skipped so its
    // animation survives.
    if (layer > 0 && layer < ARRAY_SIZE(layer_colors) && layer_colors[layer].s > 0) {
        HSV hsv = { layer_colors[layer].h, layer_colors[layer].s, val };
        RGB rgb = hsv_to_rgb(hsv);

        // Bounded by led_min/led_max: QMK paints in batches of
        // RGB_MATRIX_LED_PROCESS_LIMIT, and each half only owns its own range.
        for (uint8_t i = led_min; i < led_max; i++) {
            rgb_matrix_set_color(i, rgb.r, rgb.g, rgb.b);
        }
    }

    // Markers go on top, and keep a floor so they stay findable when the
    // brightness is turned right down.
    uint8_t mark_val = val < 110 ? 110 : val;

    for (uint8_t i = 0; i < marks.count; i++) {
        uint8_t led = marks.mark[i].led;
        if (led < led_min || led >= led_max) {
            continue;
        }

        uint8_t t = marks.mark[i].target;
        HSV     hsv;
        if (t > 0 && t < ARRAY_SIZE(layer_colors) && layer_colors[t].s > 0) {
            hsv = (HSV){ layer_colors[t].h, layer_colors[t].s, mark_val };
        } else {
            hsv = (HSV){ 0, 0, mark_val };  // white: takes you back to base
        }

        RGB rgb = hsv_to_rgb(hsv);
        rgb_matrix_set_color(led, rgb.r, rgb.g, rgb.b);
    }

    return false;
}

#endif

