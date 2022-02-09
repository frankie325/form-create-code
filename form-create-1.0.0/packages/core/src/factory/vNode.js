import {isFunction, isString, toString} from '@form-create/utils';

function parseVData(data) {
    if (isString(data))
        data = {domProps: {innerHTML: data}};
    else if (data && isFunction(data.get)) //当rule项是由FormCreate.maker.input()方式创建时，data为creator实例，调用creator.get拿到_data属性参数
        data = data.get();

    return data;
}

// 如果是方法则执行该方法，如果时VNode，则
function getVNode(VNode) {
    return isFunction(VNode) ? VNode() : (VNode || []);
}

export default class VNode {

    //为form-create组件实例
    constructor(vm) {
        if (vm)
            this.setVm(vm);
    }

    setVm(vm) {
        this.vm = vm;
        this.$h = vm.$createElement; //渲染函数
    }

    make(nodeName, data, VNodeFn) {
        // 生成rule规则的VNode
        let Node = this.$h(nodeName, parseVData(data), getVNode(VNodeFn));
        Node.context = this.vm; //设置上下文为form-create组件
        
        return Node;
    }                       
    /*
    nodes = {
        modal: 'Modal',
        button: 'i-button',
        icon: 'Icon',
        slider: 'Slider',
        rate: 'Rate',
        upload: 'fc-iview-upload',
        cascader: 'Cascader',
        colorPicker: 'Color-Picker',
        timePicker: 'Time-Picker',
        datePicker: 'Date-Picker',
        'switch': 'i-switch',
        select: 'fc-iview-select',
        checkbox: 'fc-iview-checkbox',
        radio: 'fc-iview-radio',
        inputNumber: 'Input-Number',
        input: 'i-input',
        formItem: 'Form-Item',
        form: 'i-form',
        frame: 'fc-iview-frame',
        col: 'i-col',
        row: 'row',
        tree: 'fc-iview-tree',
        autoComplete: 'AutoComplete',
    }

    在VNode原型上生成如下方法，比如button
    VNode.prototype.button = function(data, VNodeFn){
        return this.make("i-button", data, VNodeFn)
    }
    */
    static use(nodes) {
        Object.keys(nodes).forEach((k) => {
            VNode.prototype[toString(k).toLocaleLowerCase()] = VNode.prototype[k] = function (data, VNodeFn) {
                return this.make(nodes[k], data, VNodeFn);
            };
        });
    }
}
