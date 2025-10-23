package com.dynavista.FMS;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyImmersiveMode();
  }

  @Override
  public void onResume() {
    super.onResume();
    enterKiosk();              // 몰입 + 화면고정 재적용
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) applyImmersiveMode();
  }

  private void applyImmersiveMode() {
    getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
      | View.SYSTEM_UI_FLAG_FULLSCREEN
      | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    );
  }

  private void enterKiosk() {
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    try { startLockTask(); } catch (Exception ignored) {}
    applyImmersiveMode();
  }

  private void exitKiosk() {
    try { stopLockTask(); } catch (Exception ignored) {}
    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  }

  @Override
  public void onBackPressed() {
    // 필요 시 웹뷰 canGoBack 처리로 바꿔도 됨
    // super.onBackPressed(); // 호출하지 않음 → 뒤로가기 무력화
  }
}
