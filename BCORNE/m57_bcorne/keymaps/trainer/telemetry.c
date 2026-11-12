#include QMK_KEYBOARD_H
#include "raw_hid.h"
#include "telemetry.h"
#include <string.h>

// VIA owns raw_hid_receive; this is its sole keyboard-level extension.
#define TRAINER_MAGIC 0xB7
static uint32_t lease, last_heartbeat;
static bool subscribed;
static uint16_t sequence;
static uint8_t pending_row, pending_col, pending_down;
static bool pending;
static uint32_t sent_layers;
static uint8_t held[9];
static bool active(void) { return is_keyboard_master() && subscribed && timer_elapsed32(lease) < 3000; }
static void packet(uint8_t *out, uint8_t kind) {
    memset(out, 0, 32);
    out[0] = TRAINER_MAGIC; out[1] = 1; out[2] = kind;
    out[3] = sequence & 255; out[4] = sequence >> 8;
    uint32_t mask = layer_state | default_layer_state;
    for (uint8_t i = 0; i < 4; i++) out[5+i] = (mask >> (8*i)) & 255;
    memcpy(out+12, held, sizeof(held));
    sent_layers = mask;
}
static void emit(uint8_t kind, bool event) {
    uint8_t out[32]; sequence++; packet(out, kind);
    out[9] = event ? pending_row : 255; out[10] = event ? pending_col : 255;
    out[11] = event ? pending_down : 0;
    raw_hid_send(out, sizeof(out));
}
bool pre_process_record_user(uint16_t keycode, keyrecord_t *record) {
    (void)keycode;
    if (!is_keyboard_master() || record->event.key.row >= MATRIX_ROWS || record->event.key.col >= MATRIX_COLS) return true;
    // Flush the previous event before accepting another in the same scan.
    if (pending && active()) emit(0x82, true);
    pending_row = record->event.key.row; pending_col = record->event.key.col;
    pending_down = record->event.pressed;
    uint8_t bit = pending_row * 7 + pending_col;
    if (pending_down) held[bit / 8] |= 1 << (bit % 8);
    else held[bit / 8] &= ~(1 << (bit % 8));
    pending = active();
    return true;
}
void raw_hid_receive_kb(uint8_t *data, uint8_t length) {
    if (length != 32 || data[0] != TRAINER_MAGIC || data[1] != 1) { data[0] = 0xFF; return; }
    uint8_t command = data[2];
    if (command == 3) { subscribed = false; pending = false; return; }
    if (command != 1 && command != 2) { data[0] = 0xFF; return; }
    if (command == 1) { subscribed = true; pending = false; }
    if (!subscribed) return;
    lease = timer_read32();
    if (command == 1) {
        // VIA sends this response itself, preserving its single dispatcher.
        sequence++; packet(data, 0x81);
        // Versioned identity: UID bytes, matrix dimensions, telemetry capability.
        const uint8_t uid[] = VIAL_KEYBOARD_UID;
        memcpy(data + 21, uid, 8); data[29] = MATRIX_ROWS; data[30] = MATRIX_COLS; data[31] = 1;
    }
}
void trainer_task(void) {
    if (!active()) { pending = false; return; }
    if (pending) { emit(0x82, true); pending = false; }
    if (sent_layers != (uint32_t)(layer_state | default_layer_state)) emit(0x82, false);
    if (timer_elapsed32(last_heartbeat) > 1000) { emit(0x81, false); last_heartbeat = timer_read32(); }
}
