import ivuFormCreate from './core/index';

// 拿到FormCreateFactory工厂函数，导出的create方法
const FormCreate = ivuFormCreate();

if (typeof window !== 'undefined') {
    window.formCreate = FormCreate; //将create方法注册到window，通过方式3： window.formCreate.create(rule, opt)，其实就是方式2
    if (window.Vue) {
        // 执行create.install
        FormCreate.install(window.Vue);
    }
}

const maker = FormCreate.maker;

export {maker}

export default FormCreate;
