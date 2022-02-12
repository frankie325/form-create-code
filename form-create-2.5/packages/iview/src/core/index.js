import components from '../components';
import parsers from '../parsers';
import alias from './alias';
import manager from './manager';
import FormCreateFactory from '@form-create/core/src/index';
import makers from './maker';
import '../style/index.css';
import extendApi from './api';

// 在FormCreateFactory执行时调用
function install(FormCreate) {
    /*
        {
            button: 'iButton',
            icon: 'Icon',
            slider: 'Slider',
            ....
        }
    */
    // 注册用来创建表单控件VNode的方法
    FormCreate.componentAlias(alias);

    components.forEach(component => {
        FormCreate.component(component.name, component);
    });

    /*
    [
        input:{
             name:"input",
             ...
        }
        datePicker:{
            ...
        }
        ...
    ]
    遍历parsers，调用create.parser
    */ 
    parsers.forEach((parser) => {
        FormCreate.parser(parser);
    });

    Object.keys(makers).forEach(name => {
        // 将生成组件规则的maker方法添加到FormCreate.maker对象中
        FormCreate.maker[name] = makers[name];
    });
}

export default function ivuFormCreate() {
    // 执行FormCreateFactory工厂函数
    return FormCreateFactory({
        ui: `${process.env.UI}`,
        version: `${process.env.VERSION}`,
        manager,
        install,
        extendApi,
        attrs: {
            normal: ['col', 'wrap'],
            array: ['className'],
            key: ['title', 'info'],
        }
    });
}
