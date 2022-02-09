import {isFunction, preventDefault} from '@form-create/utils';
import {BaseForm} from '@form-create/core';
import style from '../style/index.css';
import {iviewConfig} from './config';

function isTooltip(info) {
    return info.type === 'tooltip';
}

export default class Form extends BaseForm {

    constructor(handle) {
        super(handle);
        this.refName = `cForm${this.id}`;  //ref名称，每个form-create组件都会有一个唯一id
        this.hidden = [];
        this.visibility = [];
    }

    // 表单配置option.form.size，添加到表单控件中
    inputVData(parser) {
        if (!parser.rule.props.size && this.options.form.size) //rule.props.size没设置才会设置全局的
            parser.vData.props('size', this.options.form.size);
    }

    getFormRef() {
        return this.vm.$refs[this.refName];
    }

    beforeRender() {
        /*  
            this.options.form为用户传入的表单配置
            生成form-create组件的vData，作为渲染函数的第二个参数
        */ 
        this.propsData = this.vData.props(this.options.form).props({  //生成props数据
            model: this.$handle.formData, 
            rules: this.$handle.validate,
            key: 'form' + this.unique
            // 取消原生表单默认的提交事件
        }).ref(this.refName).nativeOn({submit: preventDefault}).class('form-create', true).key(this.unique).get();
    }
    
    render(vn) {
        if (vn.length > 0)
            vn.push(this.makeFormBtn());
        
        // 生成Form组件的VNode，所有rule的VNode作为子节点
        return this.vNode.form(this.propsData, [this.makeRow(vn)]); //this.makeRow让整体包裹一层Row组件
    }

    // 创建Row
    makeRow(vn) {
        return this.vNode.row({props: this.options.row || {}, key: 'fr' + this.unique}, vn)
    }

    // 创建FormItem进行包裹
    container(child, parser) {
        return this.makeFormItem(parser, child);
    }


    /**
     * @description: 创建FormItem的VNode
     * @param {*} parser 
     * @param {*} child  包裹的VNode
     * @return {*}
     */    
    makeFormItem(parser, child) {
        let fItemUnique = `fItem${parser.key}${this.unique}`,
            {rule, field, formItemRefName} = parser,
            col = this.getGetCol(parser), //拿到rule.col属性
            labelWidth = (!col.labelWidth && !rule.title) ? 0 : col.labelWidth, //没有标题，labelWidth就是0
            className = rule.className, propsData = this.vData.props({
                prop: field,
                label: rule.title,
                // labelFor: unique,
                rules: rule.validate,
                labelWidth: labelWidth,
                required: rule.props.required
            }).key(fItemUnique).ref(formItemRefName).class(className).get(),

            // 创建FormItem
            node = this.vNode.formItem(propsData, [child, this.makeFormPop(parser, fItemUnique)]);

            // option.form.inline为false，每一个FormItem还会包裹一个Col组件，方便布局
        return this.propsData.props.inline === true ? node : this.makeCol(col, parser, fItemUnique, [node]);
    }

    /*
        创建提示消息，比如：
        rule = {
            info :{ 
                type: "popover" | "tooltip",
                placement: "topLeft",
                icon: "question-circle-o",
            }
        }
    */
    makeFormPop({rule}, unique) {
        if (rule.title) {
            const info = this.options.info || {}, svn = [rule.title]; //表单配置中的info，option.info
            if (rule.info) {
                svn.push(this.vNode.make(isTooltip(info) ? 'Tooltip' : 'Poptip', { //是创建Tooltip还是Poptip
                    props: {...info, content: rule.info},
                    key: `pop${unique}`
                }, [
                    this.vNode.icon({props: {type: info.icon || iviewConfig.infoIcon, size: 16}})
                ]));
            }
            return this.vNode.make('span', {slot: 'label'}, svn);
        }
    }

    // 创建col组件
    makeCol(col, parser, fItemUnique, VNodeFn) {
        if (col.span === undefined)
            col.span = 24;
        return this.vNode.col({
            props: col, 'class': {
                [style.__fc_h]: this.hidden.indexOf(parser) !== -1,
                [style.__fc_v]: this.visibility.indexOf(parser) !== -1
            }, key: `${fItemUnique}col1`
        }, VNodeFn);
    }

    // 生成提交按钮和重置按钮的[提交按钮VNode, 重置按钮VNode]
    makeFormBtn() {
        let btn = [],
            submitBtnShow = false !== this.vm.buttonProps && false !== this.vm.buttonProps.show,
            resetBtnShow = false !== this.vm.resetProps && false !== this.vm.resetProps.show;
        if (submitBtnShow)
            btn.push(this.makeSubmitBtn(resetBtnShow ? 19 : 24));
        if (resetBtnShow)
            btn.push(this.makeResetBtn(4));

        return this.propsData.props.inline === true ? btn : this.vNode.col({
            props: {span: 24},
            key: `${this.unique}col2`
        }, btn);
    }
    
    // 生成重置按钮VNode
    makeResetBtn(span) {
        const resetBtn = this.vm.resetProps,
            props = resetBtn.col || {span: span, push: 1};

        return this.vNode.col({props: props, key: `${this.unique}col3`}, [
            this.vNode.button({
                key: `frsbtn${this.unique}`, props: resetBtn, on: {
                    'click': () => {
                        const fApi = this.$handle.fCreateApi;
                        isFunction(resetBtn.click)
                            ? resetBtn.click(fApi)
                            : fApi.resetFields();
                    }
                }
            }, [resetBtn.innerText])
        ]);
    }

    // 生成提交按钮VNode
    makeSubmitBtn(span) {
        const submitBtn = this.vm.buttonProps,
            props = submitBtn.col || {span: span};

        return this.vNode.col({props: props, key: `${this.unique}col4`}, [
            this.vNode.button({
                key: `fbtn${this.unique}`, props: submitBtn, on: {
                    'click': () => {
                        const fApi = this.$handle.fCreateApi;
                        isFunction(submitBtn.click)
                            ? submitBtn.click(fApi)
                            : fApi.submit();
                    }
                }
            }, [submitBtn.innerText])
        ]);
    }
}
