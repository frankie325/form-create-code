import getConfig, {info, iviewConfig} from './config';
import mergeProps from '@form-create/utils/lib/mergeprops';
import is, {hasProperty} from '@form-create/utils/lib/type';
import extend from '@form-create/utils/lib/extend';

// 重新整理rule.title和rule.info
function tidy(props, name) {
    if (!hasProperty(props, name)) return; //如果没有定义，直接返回
    if (is.String(props[name])) { 
        /*
        如果是字符，整理成对象
        {
            title:rule.title,
            show:true,
        }
        */
        props[name] = {[name]: props[name], show: true};
    }
}

function isFalse(val) {
    return val === false;
}

function tidyBool(opt, name) {
    if (hasProperty(opt, name) && !is.Object(opt[name])) {
        opt[name] = {show: !!opt[name]};
    }
}

export default {
    validate(call) {
        this.form().validate(call);
    },
    validateField(field, call) {
        this.form().validateField(field, call);
    },
    clearValidateState(ctx) {
        const fItem = this.vm.$refs[ctx.wrapRef];
        if (fItem) {
            fItem.validateMessage = '';
            fItem.validateState = '';
        }
    },
    tidyOptions(options) {
        ['submitBtn', 'resetBtn', 'row', 'info', 'wrap', 'col'].forEach(name => {
            tidyBool(options, name);
        })
        return options;
    },
    tidyRule({prop}) {
        // prop为rule规则，重新设置rule.title和rule.info
        tidy(prop, 'title');
        tidy(prop, 'info');
        return prop;
    },
    mergeProp(ctx) {
        ctx.prop = mergeProps([{
            info: this.options.info || {},
            wrap: this.options.wrap || {},
            col: this.options.col || {},
        }, ctx.prop], {
            info: info(),
            title: {},
            col: {span: 24},
            wrap: {},
        }, {normal: ['title', 'info', 'col', 'wrap']});
        this.setSize(ctx.prop.props);
    },
    setSize(props) {
        if (!props.size && this.options.form.size) {
            props.size = this.options.form.size;
        }
    },
    // 获取默认的option配置
    getDefaultOptions() {
        return getConfig();
    },
    update() {
        // 设置manager.rule属性
        const form = this.options.form;
        this.rule = {
            props: {...form},
            nativeOn: {
                submit: (e) => {
                    e.preventDefault();
                }
            },
            class: [form.className, form.class, 'form-create'],
            style: form.style,
            type: 'form',
        };
    },
    //设置Form组件的属性
    beforeRender() {
        const {key, ref, $handle} = this; //this为Manager实例，拿到key，ref，handler

        // 设置Form组件的属性
        extend(this.rule, {key, ref});
        extend(this.rule.props, {
            model: $handle.formData,
            rules: $handle.validate(),
        });
    },
    render(children) {
        if (children.length) {
            children.push(this.makeFormBtn()); //创建提交按钮
        }
        // option.row.show为true的话，先使用Row包裹所有表单控件
        return this.$r(this.rule, isFalse(this.options.row.show) ? children : [this.makeRow(children)]);
    },
    // 创建FormItem的VNode
    makeWrap(ctx, children) {
        const rule = ctx.prop;
        const uni = `${this.key}${ctx.key}`;
        const col = rule.col; //拿到rule.col
        const isTitle = this.isTitle(rule);
        const labelWidth = (!col.labelWidth && !isTitle) ? 0 : col.labelWidth;
        const {inline, col: _col} = this.rule.props;
        const item = isFalse(rule.wrap.show) ? children : this.$r(mergeProps([rule.wrap, {
            props: {
                labelWidth,
                ...(rule.wrap || {}),
                prop: ctx.id,
                rules: rule.validate,
            },
            class: rule.className,
            key: `${uni}fi`,
            ref: ctx.wrapRef,
            type: 'formItem',
        }]), [children, isTitle ? this.makeInfo(rule, uni) : null]);
        return (inline === true || isFalse(_col) || isFalse(col.show)) ? item : this.makeCol(rule, uni, [item]);
    },
    isTitle(rule) {
        if (this.options.form.title === false) return false;
        const title = rule.title;
        return !((!title.title && !title.native) || isFalse(title.show))
    },
    // 根据rule.info配置生成VNode
    makeInfo(rule, uni) {
        const titleProp = rule.title;
        const infoProp = rule.info;
        const children = [titleProp.title];

        const titleFn = (pop) => this.$r(mergeProps([titleProp, {
            props: titleProp,
            slot: titleProp.slot || (pop ? 'default' : 'label'),
            key: `${uni}tit`,
            type: titleProp.type || 'span',
        }]), children);

        if (!isFalse(infoProp.show) && (infoProp.info || infoProp.native) && !isFalse(infoProp.icon)) {
            const prop = {
                type: infoProp.type || 'poptip',
                props: {...infoProp},
                key: `${uni}pop`,
                slot: 'label'
            };
            const field = 'content';
            if (infoProp.info && !hasProperty(prop.props, field)) {
                prop.props[field] = infoProp.info;
            }
            children[infoProp.align !== 'left' ? 'unshift' : 'push'](this.$r(mergeProps([infoProp, prop]), [
                this.$r({
                    type: 'icon',
                    props: {type: infoProp.icon === true ? iviewConfig.infoIcon : infoProp.icon, size: 16},
                    style: 'margin-top: -1px',
                    key: `${uni}i`
                })
            ]));
        }
        return this.$r(mergeProps([titleProp, {
            props: titleProp,
            slot: titleProp.slot || 'label',
            key: `${uni}tit`,
            type: titleProp.type || 'span',
        }]), children);
    },
    // 创建Col的VNode
    makeCol(rule, uni, children) {
        const col = rule.col;
        return this.$r({
            class: col.class,
            type: 'col',
            props: col || {span: 24},
            key: `${uni}col`
        }, children);
    },
    makeRow(children) {
        const row = this.options.row || {};
        return this.$r({
            type: 'row',
            props: row,
            class: row.class,
            key: `${this.key}row`
        }, children)
    },
    makeFormBtn() {
        let vn = [];
        if (!isFalse(this.options.submitBtn.show)) {
            vn.push(this.makeSubmitBtn())
        }
        if (!isFalse(this.options.resetBtn.show)) {
            vn.push(this.makeResetBtn())
        }
        if (!vn.length) {
            return;
        }
        const item = this.$r({
            type: 'formItem',
            key: `${this.key}fb`
        }, vn);

        return this.rule.props.inline === true
            ? item
            : this.$r({
                type: 'col',
                props: {span: 24},
                key: `${this.key}fc`
            }, [item]);
    },
    makeResetBtn() {
        const resetBtn = this.options.resetBtn;
        this.setSize(resetBtn);
        return this.$r({
            type: 'button',
            props: resetBtn,
            style: {width: resetBtn.width, marginLeft: '15px'},
            on: {
                click: () => {
                    const fApi = this.$handle.api;
                    resetBtn.click
                        ? resetBtn.click(fApi)
                        : fApi.resetFields();
                }
            },
            key: `${this.key}b2`,
        }, [resetBtn.innerText]);
    },
    makeSubmitBtn() {
        const submitBtn = this.options.submitBtn;
        this.setSize(submitBtn);
        return this.$r({
            type: 'button',
            props: submitBtn,
            style: {width: submitBtn.width},
            on: {
                click: () => {
                    const fApi = this.$handle.api;
                    submitBtn.click
                        ? submitBtn.click(fApi)
                        : fApi.submit();
                }
            },
            key: `${this.key}b1`,
        }, [submitBtn.innerText]);
    }
}
