import {deepExtend} from '@form-create/utils';

export const formCreateName = 'FormCreate';


/**
 * @description: form-create组件
 * @param {*} FormCreate  FormCreate类
 * @param {*} components  用户传递的自定义组件
 * @return {*}
 */
export default function $FormCreate(FormCreate, components) {
    return {
        name: formCreateName,
        props: {
            // 用户传递的rule规则
            rule: {
                type: Array,
                required: true,
                default: () => {
                    return {};
                }
            },
            // 用户传递的全局配置
            option: {
                type: Object,
                default: () => {
                    return {};
                },
                required: false
            },
            // v-model绑定的对象
            value: Object
        },
        data: () => {
            return {
                formData: undefined,
                buttonProps: undefined,
                resetProps: undefined,
                $f: undefined,
                isShow: true,
                unique: 1,
            };
        },
        components,
        render() {
            // 调用FormCreate.render
            return this.formCreate.render();
        },
        methods: {
            _buttonProps(props) {
                this.$set(this, 'buttonProps', deepExtend(this.buttonProps, props));
            },
            _resetProps(props) {
                this.$set(this, 'resetProps', deepExtend(this.resetProps, props));
            },
            _refresh() {
                this.unique += 1;
            }
        },
        watch: {
            option: '_refresh',
            rule(n) {
                this.formCreate.handle.reloadRule(n);
            }
        },
        beforeCreate() {
            // 拿到rule和option
            const {rule, option} = this.$options.propsData;
            // 创建FormCreate实例
            this.formCreate = new FormCreate(rule, option);
            // 调用FormCreate.beforeCreate
            this.formCreate.beforeCreate(this);
        },
        created() {
            // 调用FormCreate.created，主要是注册api
            this.formCreate.created();
            // 拿到上一步的api
            this.$f = this.formCreate.api();
            // 在form-create组件上使用v-model绑定，即可拿到注册的api
            this.$emit('input', this.$f);
        },
        mounted() {
            const formCreate = this.formCreate;
            // 挂载完成，执行调用FormCreate.mounted
            formCreate.mounted();
            this.$emit('input', this.$f);

        },
        beforeDestroy() {
            this.formCreate.handle.reloadRule([]);
            this.formCreate.handle.$render.clearCacheAll();
        },
    }
}