import { EInputKey_T, EInputAction_T } from "@l2js/engine/un-interactions";

// FL2ReplayManager::MakeUseCameraActionTable 0x756000.
const arrCameraKeys = new Set([
    EInputKey_T.IK_RightMouse, EInputKey_T.IK_MiddleMouse,
    EInputKey_T.IK_Shift, EInputKey_T.IK_Ctrl, EInputKey_T.IK_Alt, EInputKey_T.IK_Space,
    EInputKey_T.IK_PageUp, EInputKey_T.IK_PageDown, EInputKey_T.IK_End, EInputKey_T.IK_Home,
    EInputKey_T.IK_Left, EInputKey_T.IK_Up, EInputKey_T.IK_Right, EInputKey_T.IK_Down,
    EInputKey_T.IK_A, EInputKey_T.IK_D, EInputKey_T.IK_S, EInputKey_T.IK_W,
    EInputKey_T.IK_GreyStar, EInputKey_T.IK_GreyPlus, EInputKey_T.IK_GreyMinus, EInputKey_T.IK_GreySlash,
    EInputKey_T.IK_LShift, EInputKey_T.IK_RShift, EInputKey_T.IK_LControl, EInputKey_T.IK_RControl,
    EInputKey_T.IK_Joy1, EInputKey_T.IK_Joy2, EInputKey_T.IK_Joy3, EInputKey_T.IK_Joy4, EInputKey_T.IK_Joy12,
    EInputKey_T.IK_MouseX, EInputKey_T.IK_MouseY, EInputKey_T.IK_JoyV,
    EInputKey_T.IK_MouseWheelUp, EInputKey_T.IK_MouseWheelDown, EInputKey_T.IK_JoyZ
]);

export function isReplayCameraInput(key: number, action: number, legacy = false): boolean {
    return (arrCameraKeys.has(key) || legacy && key === EInputKey_T.IK_NumLock) &&
        (action === EInputAction_T.IST_Press || action === EInputAction_T.IST_Hold || action === EInputAction_T.IST_Release || action === EInputAction_T.IST_Axis);
}
