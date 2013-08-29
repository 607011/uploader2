#!/bin/sh
# Copyright (c) 2012 Oliver Lau <oliver@von-und-fuer-lau.de>, Heise Zeitschriften Verlag.

if [ -z "$1" ]
then
    echo "Usage: deploy.sh <version>"
    exit 1
fi

VERSION=$1
TARNAME=uploader2-${VERSION}
TARGETDIR=uploader2
DEPLOY=deploy
DIR=${DEPLOY}/${TARGETDIR}
ARCHIVEFILES="${TARGETDIR} uploaded"

echo
echo CLEANING ${DEPLOY} ..
rm -Rf ${DEPLOY}
mkdir ${DEPLOY}
cd ${DEPLOY}

echo MAKING DIRECTORIES IN ${DIR} ..
mkdir -p ${TARGETDIR}/js
mkdir -p ${TARGETDIR}/css
mkdir -p ${TARGETDIR}/img
mkdir -p ${TARGETDIR}/../uploaded
chmod 0775 ${TARGETDIR}/../uploaded
touch ${TARGETDIR}/../uploaded/HIER_LANDEN_DIE_HOCHGELADENEN_DATEIEN

cd ..

echo COPYING/CONVERTING FILES ..
cp img/* ${DIR}/img
cp -r css/src ${DIR}/css/src
cp -r js/src ${DIR}/js/src
cp *.php ${DIR}
cp config.json ${DIR}
cp ChangeLog ${DIR}
cp README.txt ${DIR}/README
cp LICENSE.txt ${DIR}/LICENSE

cp index.html ${DIR}/index.html
# sed -e "s/js\/src/js/" -e "s/css\/src/css/" index.html > ${DIR}/index.html

cd ${DEPLOY}
echo BUILDING ARCHIVE ${TARNAME}.zip ..
zip -r ${TARNAME}.zip ${ARCHIVEFILES}

echo BUILDING ARCHIVE ${TARNAME}.tar.gz ..
tar -czf ${TARNAME}.tar.gz --owner=nobody --group=www-data ${ARCHIVEFILES}

echo READY.
