import { cpu_cores, cpu_name, kernel_name, amount_of_ram, gpu_name, cur_uptime } from "variables.ts";
import Gtk from "gi://Gtk?version=3.0";
import { Variable as VariableType } from "types/variable";
import backlight_service from "services/backlight.ts";
import { sideright } from "./main";
import Pango10 from "gi://Pango";

type InfoType = {
    cpu: {percent: string, value?: string};
    ram: {percent: string, value?: string};
    swap: {percent: string, value?: string};
    disk: {percent: string, value: string};
    cpu_temp: {percent: string, value?: string};
};

async function SystemInfo(currentUsage): Promise<InfoType> {
    const cpu_usage = await Utils.execAsync(`${App.configDir}/scripts/system.sh --cpu-usage-percent`)
        .then((str) => String(str))
        .catch((err) => {
            print(err);
            return "0";
        });
    const ram_usage = await Utils.execAsync(`${App.configDir}/scripts/system.sh --ram-usage-percent`)
        .then((str) => String(str))
        .catch((err) => {
            print(err);
            return "0";
        });
    const swap_usage = await Utils.execAsync(`${App.configDir}/scripts/system.sh --swap-usage-percent`)
        .then((str) => String(str))
        .catch((err) => {
            print(err);
            return "0";
        });
    const cpu_temp = await Utils.execAsync(`${App.configDir}/scripts/system.sh --cpu-temp`)
        .then((str) => String(str))
        .catch((err) => {
            print(err);
            return "0";
        });
    
    let disk_usage = currentUsage['disk'].value;
    let disk_usage_percent = currentUsage['disk'].percent;
    if(currentUsage['disk'].percent === "0"){
        disk_usage_percent = await Utils.execAsync(`${App.configDir}/scripts/system.sh --disk-usage-percent`)
            .then((str) => String(str))
            .catch((err) => {
                print(err);
                return "0";
            });

        disk_usage = await Utils.execAsync(`${App.configDir}/scripts/system.sh --disk-usage`)
            .then((str) => String(str))
            .catch((err) => {
                print(err);
                return "0";
            });
    } 

    return {
        cpu: {percent: cpu_usage, value: undefined},
        ram: {percent: ram_usage, value: undefined},
        swap: {percent: swap_usage, value: undefined},
        disk: {percent: disk_usage_percent, value: disk_usage},
        cpu_temp: {percent: cpu_temp, value: undefined}
    };
}

function checkBrightness() {
    const get = Utils.execAsync(`${App.configDir}/scripts/brightness.sh --get`)
        .then((out) => Number(out.trim()))
        .catch(print);
    return get;
}

export const current_brightness = Variable(100, {
    poll: [
        500,
        () => {
            if (sideright?.visible) return checkBrightness();
            else return current_brightness?.value || 100;
        }
    ]
});

const usage_default = {
    cpu: {percent: "0", value: undefined},
    ram: {percent: "0", value: undefined},
    swap: {percent: "0", value: undefined},
    cpu_temp: {percent: "0", value: undefined},
    disk: {percent: "0", value: "0"}
};

const usage = Variable(usage_default);
Utils.interval(1000, async () => {
    Utils.idle(() => {
        if (sideright?.visible) {
            SystemInfo(usage.value).then((result) => {
                usage.setValue(result);
            });
        }
    });
});

const Usage = (name: string, var_name: keyof InfoType, class_name: string | undefined) => {
    const usage_progress_bar = Widget.ProgressBar({
        class_name: "usage_bar",
        value: usage.bind().as((usage) => Number(usage[var_name].percent) / 100)
    });
    const usage_overlay = Widget.Overlay({
        child: usage_progress_bar,
        overlay: Widget.Box({
            hpack: "end",
            vpack: "center",
            class_name: "usage_bar_point"
        })
    });
    const _usage = Widget.Box({
        class_name: `${class_name} usage_box_inner`,
        orientation: Gtk.Orientation.VERTICAL,
        children: [
            Widget.Label({
                label: usage.bind().as((usage) => `${name}: ${usage[var_name].percent}% ${usage[var_name].value? '(' + usage[var_name]?.value + ')' : ''}`),
                hpack: "start",
                vpack: "center"
            }),
            usage_overlay
        ]
    });

    return _usage;
};

const InfoLabel = (name: string, var_name: keyof InfoType, end: string) => {
    return Widget.Box({
        class_name: "info_label",
        children: [
            Widget.Label({
                xalign: 0,
                hpack: "start",
                width_chars: 10,
                label: name
            }),
            Widget.Label({
                wrap: true,
                xalign: 0,
                hpack: "start",
                label: usage.bind().as((usage) => `: ${usage[var_name].percent}${end}`)
            })
        ]
    });
};

const InfoLabelString = (name: string, value: string, end: string) => {
    return Widget.Box({
        class_name: "info_label",
        children: [
            Widget.Label({
                xalign: 0,
                hpack: "start",
                width_chars: 10,
                label: `${name}`
            }),
            Widget.Label({
                wrap: true,
                wrap_mode: Pango10.WrapMode.WORD_CHAR,
                xalign: 0,
                hpack: "start",
                label: `: ${value}${end}`
            })
        ]
    });
};

const InfoLabelVariableString = (name: string, value: VariableType<string>, end: string) => {
    return Widget.Box({
        class_name: "info_label",
        children: [
            Widget.Label({
                xalign: 0,
                hpack: "start",
                width_chars: 10,
                label: name
            }),
            Widget.Label({
                wrap: true,
                wrap_mode: Pango10.WrapMode.WORD_CHAR,
                xalign: 0,
                hpack: "start",
                label: value.bind().as((value) => `: ${value}${end}`)
            })
        ]
    });
};

export function SystemBox() {
    const backlight = Widget.Slider({
        min: 0,
        max: 100,
        draw_value: false,
        class_name: "system_scale backlight",
        // @ts-ignore
        value: backlight_service.bind("screen_value").as((n) => n * 100),
        on_change: (self) => {
            backlight_service.screen_value = self.value / 100;
        },
        tooltip_markup: "Backlight"
    });
    const brightness = Widget.Slider({
        min: 0,
        max: 1,
        draw_value: false,
        class_name: "system_scale brightness",
        // @ts-ignore
        value: current_brightness.bind(),
        on_change: (self) => {
            current_brightness.setValue(Number(self.value));
            Utils.execAsync(`${App.configDir}/scripts/brightness.sh --set ${self.value}`).catch(print);
        },
        tooltip_markup: "Brightness"
    });
    const slider_box = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        class_name: "slider_box",
        children: [backlight, brightness]
    });

    const usage_box = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        class_name: "usage_box",
        spacing: 0,
        children: [
            Usage("CPU", "cpu", "cpu_usage"),
            Usage("RAM", "ram", "ram_usage"),
            Usage("SWAP", "swap", "swap_usage"),
            Usage("DISK", "disk", "disk_usage")
        ]
    });

    const info_box = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        class_name: "info_box",
        spacing: 0,
        children: [
            InfoLabel("CPU temp", "cpu_temp", "°C"),
            InfoLabelString("CPU name", cpu_name, ""),
            InfoLabelString("CPU cores", cpu_cores, ""),
            InfoLabelString("RAM amount", amount_of_ram, ""),
            InfoLabelString("Kernel", kernel_name, ""),
            InfoLabelString("GPU", gpu_name, ""),
            InfoLabelVariableString("Uptime", cur_uptime, "")
        ],
        vexpand: true
    });

    return Widget.Scrollable({
        child: Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            class_name: "system_box",
            spacing: 10,
            children: [slider_box, usage_box, info_box]
        })
    });
}
