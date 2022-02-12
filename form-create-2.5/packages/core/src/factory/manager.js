import mergeProps from '@form-create/utils/lib/mergeprops';
import unique from '@form-create/utils/lib/unique';
import extend from '@form-create/utils/lib/extend';

// 创建Manager子类，proto是一个对象，为用到的一些方法
export function createManager(proto) {
    class CustomManager extends Manager {
    }

    Object.assign(CustomManager.prototype, proto);
    return CustomManager;
}

export default function Manager(handler) {
    extend(this, {
        $handle: handler, //handler实例
        vm: handler.vm, //form-create组件实例
        options: {},
        ref: 'fcForm',
        mergeOptionsRule: {
            normal: ['form', 'row', 'info', 'submitBtn', 'resetBtn']
        }
    });
    this.updateKey();
    this.init();
}

extend(Manager.prototype, {
    __init() {
        this.$render = this.$handle.$render; //render实例

        // 用来调用render.renderRule方法
        this.$r = (...args) => this.$render.renderRule(...args);
    },
    updateKey() {
        this.key = unique();
    },
    //TODO interface
    init() {
    },
    update() {
    },
    beforeRender() {
    },
    form() {
        return this.vm.$refs[this.ref];
    },
    // 合并用户传递的option配置合并到fc.options
    mergeOptions(args, opt) {
        return mergeProps(args.map(v => this.tidyOptions(v)), opt, this.mergeOptionsRule);
    },
    updateOptions(options) {
        // 将handler.options添加到manager.options
        this.options = this.mergeOptions([options], this.getDefaultOptions());
        // 设置this.rule，也就是Form组件的rule
        this.update();
    },
    tidyOptions(options) {
        return options;
    },
    tidyRule(ctx) {
    },
    mergeProp(ctx) {
    },
    getDefaultOptions() {
        return {};
    },
    render(children) {
    }
})
