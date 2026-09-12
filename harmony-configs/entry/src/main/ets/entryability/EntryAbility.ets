/**
 * EntryAbility 覆盖版（harmony-configs 机制：构建时整文件覆盖自动生成工程的同名文件）。
 * 内容 = HBuilderX 生成的开发版模板 + 下方 setWindowLayoutFullScreen 沉浸式调用。
 *
 * ⚠️ 注意：
 * 1. 本文件基于「运行到鸿蒙」的开发版模板（UniEntryAbilityDev + hmr）。
 *    若将来构建**正式发行包**报错（发行模板类名/依赖可能不同），把 setWindowLayoutFullScreen
 *    那一段同样加进发行工程生成的 EntryAbility 即可，其余回退为生成版内容。
 * 2. UNI_APPID 字面量与 manifest 一致；若更换 appid 请同步修改这里。
 *
 * 沉浸式效果：窗口内容延伸到状态栏/小白条手势区下面，专注页底部不再露出系统白条。
 * 页面自身已用 statusBarH / env(safe-area-inset-bottom) 预留安全区，不会被遮挡。
 */
import { UniEntryAbilityDev } from "@dcloudio/uni-app-runtime";
import { initUniModules } from "../uni_modules/index.generated";
import BuildProfile from "BuildProfile";
import * as hmr from '@uni_modules/hmr-for-uni-app'
import window from '@ohos.window';

initUniModules();

interface IHmr {
  init: Function
}

// 此处的字面量在应用到鸿蒙工程目录时会被替换为真正的 APPID
const UNI_APPID = "__UNI__B22C10E";

export default class EntryAbility extends UniEntryAbilityDev {
  constructor() {
    super(UNI_APPID, {
      debug: BuildProfile.DEBUG,
    });
  }

  onWindowStageCreate(windowStage: window.WindowStage) {
    super.onWindowStageCreate(windowStage)
    hmr.init(UNI_APPID);
    // 沉浸式：窗口全屏布局，内容绘制到小白条手势区下方（消除页面底部的系统白条）
    windowStage.getMainWindow((err, win) => {
      if (err || !win) return
      win.setWindowLayoutFullScreen(true)
    })
  }
}
