import {creatorTypeFactory} from '@form-create/core';

const name = 'input';

/*
input由多种类型，可以使用下面方式创建
maker.password('密码', 'password', 123),
*/ 
const maker = ['password', 'url', 'email', 'text', 'textarea'].reduce((maker, type) => {
    maker[type] = creatorTypeFactory(name, type);
    return maker;
}, {});

maker.idate = creatorTypeFactory(name, 'date');

export default maker;